#!/usr/bin/env python3
"""
Database migration script to add tables for real data logging
This script adds AI decision logging and market data cache tables
"""

import asyncio
import sys
from pathlib import Path

# Add the project root to Python path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from ai_trading_system.config.settings import load_config
from ai_trading_system.services.data_storage import DatabaseConnection
from ai_trading_system.utils.logging import get_logger


async def add_real_data_tables():
    """Add tables for real data logging"""
    logger = get_logger("add_real_data_tables")
    
    try:
        # Load configuration
        config = load_config()
        
        if not config.database:
            logger.error("Database configuration not found. Please set DB_* environment variables.")
            return False
        
        logger.info("Adding real data tables to database", {
            "host": config.database.host,
            "port": config.database.port,
            "database": config.database.database
        })
        
        # Create database connection
        db = DatabaseConnection(config.database)
        
        # Connect to database
        await db.connect()
        logger.info("Connected to database successfully")
        
        # Define new table creation statements
        table_statements = [
            # AI decision logging table
            """
            CREATE TABLE IF NOT EXISTS ai_decisions (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                timestamp TIMESTAMP NOT NULL,
                decision_type VARCHAR(50) NOT NULL,
                symbol VARCHAR(20) NOT NULL,
                confidence DECIMAL(5,3) NOT NULL,
                technical_score DECIMAL(5,3),
                sentiment_score DECIMAL(5,3),
                event_impact DECIMAL(5,3),
                final_confidence DECIMAL(5,3),
                risk_factors JSONB,
                reasoning JSONB,
                factors JSONB,
                outcome JSONB,
                metadata JSONB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """,
            
            # Market data cache table for live prices
            """
            CREATE TABLE IF NOT EXISTS market_data_cache (
                symbol VARCHAR(20) PRIMARY KEY,
                price DECIMAL(15,8) NOT NULL,
                change_24h DECIMAL(10,4),
                volume_24h DECIMAL(20,2),
                high_24h DECIMAL(15,8),
                low_24h DECIMAL(15,8),
                market_cap DECIMAL(20,2),
                source VARCHAR(50) NOT NULL DEFAULT 'coingecko',
                last_updated TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """,
            
            # Real-time sentiment analysis results
            """
            CREATE TABLE IF NOT EXISTS sentiment_analysis (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                symbol VARCHAR(20) NOT NULL,
                sentiment VARCHAR(20) NOT NULL,
                confidence DECIMAL(5,3) NOT NULL,
                key_factors JSONB,
                news_impact DECIMAL(5,3),
                social_impact DECIMAL(5,3),
                processing_time_ms INTEGER,
                source VARCHAR(50) NOT NULL,
                timestamp TIMESTAMP NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """,
            
            # System events and status logging
            """
            CREATE TABLE IF NOT EXISTS system_events (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                event_type VARCHAR(50) NOT NULL,
                event_data JSONB,
                severity VARCHAR(20) NOT NULL DEFAULT 'INFO',
                component VARCHAR(50),
                message TEXT,
                timestamp TIMESTAMP NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """
        ]
        
        # Define indexes for the new tables
        index_statements = [
            # AI decisions indexes
            "CREATE INDEX IF NOT EXISTS idx_ai_decisions_timestamp ON ai_decisions(timestamp DESC)",
            "CREATE INDEX IF NOT EXISTS idx_ai_decisions_symbol ON ai_decisions(symbol)",
            "CREATE INDEX IF NOT EXISTS idx_ai_decisions_type ON ai_decisions(decision_type)",
            "CREATE INDEX IF NOT EXISTS idx_ai_decisions_confidence ON ai_decisions(confidence DESC)",
            
            # Market data cache indexes
            "CREATE INDEX IF NOT EXISTS idx_market_data_cache_updated ON market_data_cache(last_updated DESC)",
            "CREATE INDEX IF NOT EXISTS idx_market_data_cache_source ON market_data_cache(source)",
            
            # Sentiment analysis indexes
            "CREATE INDEX IF NOT EXISTS idx_sentiment_analysis_symbol ON sentiment_analysis(symbol)",
            "CREATE INDEX IF NOT EXISTS idx_sentiment_analysis_timestamp ON sentiment_analysis(timestamp DESC)",
            "CREATE INDEX IF NOT EXISTS idx_sentiment_analysis_sentiment ON sentiment_analysis(sentiment)",
            
            # System events indexes
            "CREATE INDEX IF NOT EXISTS idx_system_events_timestamp ON system_events(timestamp DESC)",
            "CREATE INDEX IF NOT EXISTS idx_system_events_type ON system_events(event_type)",
            "CREATE INDEX IF NOT EXISTS idx_system_events_component ON system_events(component)",
            "CREATE INDEX IF NOT EXISTS idx_system_events_severity ON system_events(severity)"
        ]
        
        # Execute table creation
        async with db.engine.begin() as conn:
            from sqlalchemy import text
            
            # Create tables first
            for statement in table_statements:
                logger.info(f"Creating table: {statement.split('(')[0].split()[-1]}")
                await conn.execute(text(statement.strip()))
            
            # Create indexes
            for statement in index_statements:
                logger.info(f"Creating index: {statement.split()[-1].split('(')[0]}")
                await conn.execute(text(statement))
        
        logger.info("Real data tables created successfully")
        
        # Disconnect
        await db.disconnect()
        logger.info("Database migration completed")
        
        return True
        
    except Exception as e:
        logger.error("Database migration failed", {"error": str(e)})
        return False


def main():
    """Main entry point"""
    print("🚀 Adding Real Data Tables to Database...")
    
    success = asyncio.run(add_real_data_tables())
    
    if success:
        print("✅ Real data tables added successfully!")
        print("\nNew tables created:")
        print("- ai_decisions: For logging actual AI trading decisions")
        print("- market_data_cache: For caching live market prices")
        print("- sentiment_analysis: For storing real sentiment analysis results")
        print("- system_events: For logging system events and status")
        print("\nNext steps:")
        print("1. Update data bridge to use real data sources")
        print("2. Update API endpoints to remove mock data")
        print("3. Update frontend to handle real data states")
    else:
        print("❌ Database migration failed. Check the logs above.")
        sys.exit(1)


if __name__ == "__main__":
    main()