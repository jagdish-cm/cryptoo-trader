"""
Main entry point for the AI Trading System
"""

import asyncio
import signal
import sys
from typing import Optional

from ai_trading_system.config.settings import load_config, validate_config
from ai_trading_system.services.data_storage import DatabaseConnection, RedisCache, DataAccessObject
from ai_trading_system.services.exchange_client import ExchangeClient, CCXTMarketDataCollector
from ai_trading_system.services.llm_client import LLMClient
from ai_trading_system.analyzers.regime_analyzer import BitcoinPriceAnalyzer
from ai_trading_system.analyzers.strategy_manager import StrategyModeManager
from ai_trading_system.analyzers.technical_analyzer import TechnicalAnalyzer
from ai_trading_system.analyzers.sentiment_analyzer import SentimentAnalyzer, EventDetector
from ai_trading_system.analyzers.fusion_engine import FusionEngine
from ai_trading_system.analyzers.setup_scanner import SetupScanner
from ai_trading_system.services.paper_trading_service import PaperTradingService
from ai_trading_system.utils.logging import get_logger


class TradingSystemOrchestrator:
    """Main orchestrator for the AI trading system"""
    
    def __init__(self):
        self.logger = get_logger("trading_system")
        self.config = None
        self.components = {}
        self.running = False
        
    async def initialize(self):
        """Initialize all system components"""
        try:
            # Load and validate configuration
            self.config = load_config()
            warnings = validate_config(self.config)
            
            if warnings:
                self.logger.warning("Configuration warnings detected", {"warnings": warnings})
            
            self.logger.info("Initializing AI Trading System", {
                "version": "0.1.0",
                "exchange": self.config.exchange.name if self.config.exchange else "None",
                "sandbox": self.config.exchange.sandbox if self.config.exchange else False,
                "watchlist": self.config.trading.watchlist
            })
            
            # Initialize data layer
            await self._initialize_data_layer()
            
            # Initialize analysis components
            await self._initialize_analyzers()
            
            # Initialize trading components
            await self._initialize_trading_components()
            
            self.logger.info("System initialization completed successfully")
            
        except Exception as e:
            self.logger.error("System initialization failed", {"error": str(e)})
            raise
    
    async def _initialize_data_layer(self):
        """Initialize data storage and exchange connections"""
        # Database connection
        if self.config.database:
            self.components['database'] = DatabaseConnection(self.config.database)
            await self.components['database'].connect()
            self.logger.info("Database connected")
        
        # Redis cache
        self.components['cache'] = RedisCache(self.config.redis)
        await self.components['cache'].connect()
        self.logger.info("Redis cache connected")
        
        # Data Access Object
        self.components['dao'] = DataAccessObject(
            self.components.get('database'),
            self.components['cache']
        )
        
        # Exchange client
        if self.config.exchange:
            self.components['exchange'] = ExchangeClient(self.config.exchange)
            await self.components['exchange'].connect()
            self.logger.info("Exchange connected", {
                "exchange": self.config.exchange.name,
                "sandbox": self.config.exchange.sandbox
            })
            
            # Market data collector
            self.components['market_data_collector'] = CCXTMarketDataCollector(
                self.components['exchange'],
                self.config.trading.watchlist,
                self.config.trading.timeframe
            )
    
    async def _initialize_analyzers(self):
        """Initialize analysis components"""
        dao = self.components['dao']
        
        # Bitcoin price analyzer for regime detection
        self.components['bitcoin_analyzer'] = BitcoinPriceAnalyzer(dao)
        await self.components['bitcoin_analyzer'].initialize()
        
        # Strategy mode manager
        self.components['strategy_manager'] = StrategyModeManager(
            dao, 
            self.components['bitcoin_analyzer']
        )
        await self.components['strategy_manager'].initialize()
        
        # Technical analyzer
        self.components['technical_analyzer'] = TechnicalAnalyzer(dao)
        await self.components['technical_analyzer'].initialize()
        
        # LLM client and sentiment analysis
        if self.config.llm:
            self.components['llm_client'] = LLMClient(self.config.llm, self.components['cache'])
            
            self.components['sentiment_analyzer'] = SentimentAnalyzer(
                dao, 
                self.components['llm_client']
            )
            await self.components['sentiment_analyzer'].initialize()
            
            self.components['event_detector'] = EventDetector(
                dao, 
                self.components['llm_client']
            )
            await self.components['event_detector'].initialize()
            
            # Fusion engine
            self.components['fusion_engine'] = FusionEngine(
                dao,
                self.components['technical_analyzer'],
                self.components['sentiment_analyzer'],
                self.components['event_detector']
            )
            await self.components['fusion_engine'].initialize()
        
        self.logger.info("Analysis components initialized")
    
    async def _initialize_trading_components(self):
        """Initialize trading-specific components"""
        dao = self.components['dao']
        
        # Setup scanner
        if 'technical_analyzer' in self.components:
            self.components['setup_scanner'] = SetupScanner(
                dao,
                self.components['technical_analyzer']
            )
            await self.components['setup_scanner'].initialize(self.config.trading.watchlist)
        
        # Paper trading service
        self.components['paper_trading'] = PaperTradingService(dao)
        await self.components['paper_trading'].initialize()
        
        self.logger.info("Trading components initialized")
    
    async def start(self):
        """Start the trading system"""
        if self.running:
            self.logger.warning("System already running")
            return
        
        self.running = True
        self.logger.info("Starting AI Trading System")
        
        try:
            # Start strategy manager monitoring
            if 'strategy_manager' in self.components:
                await self.components['strategy_manager'].start_monitoring()
            
            # Start setup scanner
            if 'setup_scanner' in self.components:
                await self.components['setup_scanner'].start_scanning()
            
            # Start market data collection
            if 'market_data_collector' in self.components:
                await self.components['market_data_collector'].start()
            
            # Start paper trading position updates
            if 'paper_trading' in self.components:
                asyncio.create_task(self._position_update_loop())
            
            self.logger.info("All components started successfully")
            
            # Main system loop
            await self._main_loop()
            
        except Exception as e:
            self.logger.error("Error during system operation", {"error": str(e)})
            raise
    
    async def _main_loop(self):
        """Main system operation loop"""
        self.logger.info("Entering main system loop")
        
        try:
            while self.running:
                # System health check
                await self._health_check()
                
                # Demo: Generate signals for watchlist
                if 'fusion_engine' in self.components:
                    await self._demo_signal_generation()
                
                # Wait before next iteration
                await asyncio.sleep(self.config.health_check_interval)
                
        except asyncio.CancelledError:
            self.logger.info("Main loop cancelled")
        except Exception as e:
            self.logger.error("Error in main loop", {"error": str(e)})
            raise
    
    async def _health_check(self):
        """Perform system health check"""
        try:
            # Check key components
            if 'cache' in self.components:
                await self.components['cache'].set("health_check", "ok", ttl=60)
            
            if 'exchange' in self.components:
                # Test exchange connectivity
                await self.components['exchange'].fetch_ticker("BTC/USDT")
            
            self.logger.debug("Health check passed")
            
        except Exception as e:
            self.logger.warning("Health check failed", {"error": str(e)})
    
    async def _demo_signal_generation(self):
        """Demo signal generation for paper trading"""
        try:
            fusion_engine = self.components.get('fusion_engine')
            strategy_manager = self.components.get('strategy_manager')
            
            if not fusion_engine or not strategy_manager:
                return
            
            # Get current strategy mode
            current_mode = strategy_manager.get_current_strategy_mode()
            current_regime = strategy_manager.get_current_regime()
            
            self.logger.info("Current market regime", {
                "regime": current_regime.value,
                "strategy_mode": current_mode.value
            })
            
            # Generate signals for a few symbols (demo)
            demo_symbols = self.config.trading.watchlist[:3]  # First 3 symbols
            
            for symbol in demo_symbols:
                try:
                    signal = await fusion_engine.analyze(symbol)
                    
                    if signal:
                        # Check if trade is allowed in current regime
                        if strategy_manager.is_trade_allowed(signal.direction):
                            self.logger.info("Trading signal generated", {
                                "symbol": symbol,
                                "direction": signal.direction.value,
                                "confidence": float(signal.confidence),
                                "setup_type": signal.setup_type.value,
                                "entry_price": float(signal.entry_price) if signal.entry_price else None
                            })
                            
                            # Execute paper trade
                            paper_trading = self.components.get('paper_trading')
                            if paper_trading:
                                position = await paper_trading.execute_signal(signal)
                                if position:
                                    self.logger.info("Paper trade executed", {
                                        "position_id": position.id,
                                        "symbol": position.symbol,
                                        "direction": position.direction.value,
                                        "entry_price": float(position.entry_price),
                                        "quantity": float(position.quantity)
                                    })
                            
                        else:
                            self.logger.debug("Signal filtered by strategy mode", {
                                "symbol": symbol,
                                "direction": signal.direction.value,
                                "current_mode": current_mode.value
                            })
                    
                except Exception as e:
                    self.logger.warning("Signal generation failed", {
                        "symbol": symbol,
                        "error": str(e)
                    })
                
                # Small delay between symbols
                await asyncio.sleep(1)
                
        except Exception as e:
            self.logger.error("Demo signal generation failed", {"error": str(e)})
    
    async def _position_update_loop(self):
        """Background task to update paper trading positions"""
        self.logger.info("Starting position update loop")
        
        while self.running:
            try:
                paper_trading = self.components.get('paper_trading')
                if paper_trading:
                    await paper_trading.update_positions()
                
                # Update every 30 seconds
                await asyncio.sleep(30)
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                self.logger.error("Error in position update loop", {"error": str(e)})
                await asyncio.sleep(60)  # Wait longer on error
        
        self.logger.info("Position update loop stopped")
    
    async def stop(self):
        """Stop the trading system"""
        if not self.running:
            return
        
        self.running = False
        self.logger.info("Stopping AI Trading System")
        
        try:
            # Stop components in reverse order
            if 'setup_scanner' in self.components:
                await self.components['setup_scanner'].stop_scanning()
            
            if 'strategy_manager' in self.components:
                await self.components['strategy_manager'].stop_monitoring()
            
            if 'market_data_collector' in self.components:
                await self.components['market_data_collector'].stop()
            
            if 'exchange' in self.components:
                await self.components['exchange'].disconnect()
            
            if 'cache' in self.components:
                await self.components['cache'].disconnect()
            
            if 'database' in self.components:
                await self.components['database'].disconnect()
            
            self.logger.info("System stopped successfully")
            
        except Exception as e:
            self.logger.error("Error during system shutdown", {"error": str(e)})


# Global system instance
system: Optional[TradingSystemOrchestrator] = None


async def main():
    """Main application entry point"""
    global system
    
    # Setup signal handlers for graceful shutdown
    def signal_handler(signum, frame):
        print(f"\n🛑 Received signal {signum}, shutting down gracefully...")
        if system:
            asyncio.create_task(system.stop())
    
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    try:
        # Create and initialize system
        system = TradingSystemOrchestrator()
        await system.initialize()
        
        # Start the system
        await system.start()
        
    except KeyboardInterrupt:
        print("\n🛑 Keyboard interrupt received")
    except Exception as e:
        print(f"❌ System error: {e}")
        sys.exit(1)
    finally:
        if system:
            await system.stop()


if __name__ == "__main__":
    print("🚀 Starting AI Trading System...")
    asyncio.run(main())