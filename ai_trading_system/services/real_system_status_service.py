"""
Real System Status Service - Provides actual system status data
This service replaces mock system status with real system information
"""

import asyncio
import psutil
import time
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
from dataclasses import dataclass

from ai_trading_system.services.data_storage import DataAccessObject
from ai_trading_system.utils.logging import get_logger


@dataclass
class SystemStatus:
    """Real system status data structure"""
    status: str  # RUNNING, STOPPED, ERROR, STARTING, STOPPING
    uptime: int  # Seconds since system start
    last_heartbeat: datetime
    active_connections: int
    processing_symbol: Optional[str]
    current_phase: str
    errors: List[Dict[str, Any]]
    cpu_usage: float
    memory_usage: float
    disk_usage: float
    database_connected: bool
    redis_connected: bool


class RealSystemStatusService:
    """Service for managing real system status information"""
    
    def __init__(self, dao: DataAccessObject):
        self.dao = dao
        self.logger = get_logger("real_system_status")
        self.system_start_time = datetime.utcnow()
        self.current_status = "STOPPED"
        self.current_processing_symbol = None
        self.current_phase = "IDLE"
        self.system_errors = []
        
    def set_system_start_time(self, start_time: datetime = None):
        """Set the system start time (called when system actually starts)"""
        self.system_start_time = start_time or datetime.utcnow()
        self.current_status = "RUNNING"
        self.logger.info(f"System start time set to: {self.system_start_time}")
    
    def set_status(self, status: str):
        """Update the current system status"""
        self.current_status = status
        self.logger.info(f"System status updated to: {status}")
        
        # Log status change to database
        asyncio.create_task(self._log_system_event("STATUS_CHANGE", {
            "new_status": status,
            "timestamp": datetime.utcnow().isoformat()
        }))
    
    def set_processing_info(self, symbol: str = None, phase: str = "IDLE"):
        """Update current processing information"""
        self.current_processing_symbol = symbol
        self.current_phase = phase
        
        if symbol:
            self.logger.debug(f"Processing {symbol} in phase {phase}")
    
    def add_error(self, error_type: str, message: str, details: Dict = None):
        """Add a system error"""
        error = {
            "type": error_type,
            "message": message,
            "details": details or {},
            "timestamp": datetime.utcnow().isoformat()
        }
        
        self.system_errors.append(error)
        
        # Keep only last 10 errors
        if len(self.system_errors) > 10:
            self.system_errors = self.system_errors[-10:]
        
        self.logger.error(f"System error added: {error_type} - {message}")
        
        # Log error to database
        asyncio.create_task(self._log_system_event("ERROR", error))
    
    def clear_errors(self):
        """Clear all system errors"""
        self.system_errors = []
        self.logger.info("System errors cleared")
    
    async def get_system_status(self, active_connections: int = 0) -> SystemStatus:
        """Get comprehensive real system status"""
        try:
            # Auto-detect if system is running based on recent activity
            actual_status = await self._detect_system_status()
            
            # Update our internal status if we detected the system is running
            if actual_status == "RUNNING" and self.current_status == "STOPPED":
                self.current_status = "RUNNING"
                # Update start time based on recent activity
                recent_start_time = await self._get_system_start_time()
                if recent_start_time:
                    self.system_start_time = recent_start_time
            
            # Calculate real uptime
            uptime_seconds = int((datetime.utcnow() - self.system_start_time).total_seconds())
            
            # Get system resource usage
            cpu_usage = psutil.cpu_percent(interval=0.1)
            memory = psutil.virtual_memory()
            disk = psutil.disk_usage('/')
            
            # Check database and Redis connectivity
            database_connected = await self._check_database_connection()
            redis_connected = await self._check_redis_connection()
            
            # Get current processing info from database if available
            processing_info = await self._get_current_processing_info()
            
            status = SystemStatus(
                status=actual_status,
                uptime=uptime_seconds,
                last_heartbeat=datetime.utcnow(),
                active_connections=active_connections,
                processing_symbol=processing_info.get('symbol', self.current_processing_symbol),
                current_phase=processing_info.get('phase', self.current_phase),
                errors=self.system_errors.copy(),
                cpu_usage=round(cpu_usage, 1),
                memory_usage=round(memory.percent, 1),
                disk_usage=round(disk.percent, 1),
                database_connected=database_connected,
                redis_connected=redis_connected
            )
            
            self.logger.debug(f"System status retrieved: {self.current_status}, "
                            f"Uptime: {uptime_seconds}s, CPU: {cpu_usage}%")
            
            return status
            
        except Exception as e:
            self.logger.error(f"Failed to get system status: {e}")
            # Return minimal status on error
            return SystemStatus(
                status="ERROR",
                uptime=0,
                last_heartbeat=datetime.utcnow(),
                active_connections=active_connections,
                processing_symbol=None,
                current_phase="ERROR",
                errors=[{
                    "type": "SYSTEM_ERROR",
                    "message": f"Failed to get system status: {str(e)}",
                    "timestamp": datetime.utcnow().isoformat()
                }],
                cpu_usage=0.0,
                memory_usage=0.0,
                disk_usage=0.0,
                database_connected=False,
                redis_connected=False
            )
    
    async def _check_database_connection(self) -> bool:
        """Check if database is connected and responsive"""
        try:
            if not self.dao or not self.dao.db:
                return False
            
            # Simple query to test connection
            result = await self.dao.db.execute_query("SELECT 1 as test")
            return len(result) > 0 and result[0].get('test') == 1
            
        except Exception as e:
            self.logger.debug(f"Database connection check failed: {e}")
            return False
    
    async def _check_redis_connection(self) -> bool:
        """Check if Redis is connected and responsive"""
        try:
            if not self.dao or not self.dao.cache:
                return False
            
            # Simple ping to test connection
            test_key = "system_status_test"
            await self.dao.cache.set(test_key, "test", ttl=1)
            result = await self.dao.cache.get(test_key)
            await self.dao.cache.delete(test_key)
            
            return result == "test"
            
        except Exception as e:
            self.logger.debug(f"Redis connection check failed: {e}")
            return False
    
    async def _get_current_processing_info(self) -> Dict[str, str]:
        """Get current processing information from system events or cache"""
        try:
            # Try to get from cache first
            processing_info = await self.dao.cache.get("system:current_processing")
            if processing_info:
                return processing_info
            
            # Try to get from recent system events
            query = """
            SELECT event_data
            FROM system_events
            WHERE event_type = 'PROCESSING_UPDATE'
            ORDER BY timestamp DESC
            LIMIT 1
            """
            
            result = await self.dao.db.execute_query(query)
            if result and result[0]['event_data']:
                event_data = result[0]['event_data']
                return {
                    'symbol': event_data.get('symbol'),
                    'phase': event_data.get('phase', 'IDLE')
                }
            
            return {'symbol': None, 'phase': 'IDLE'}
            
        except Exception as e:
            self.logger.debug(f"Failed to get processing info: {e}")
            return {'symbol': None, 'phase': 'IDLE'}
    
    async def _log_system_event(self, event_type: str, event_data: Dict):
        """Log system events to database"""
        try:
            query = """
            INSERT INTO system_events (event_type, event_data, severity, component, message, timestamp)
            VALUES (:event_type, :event_data, :severity, :component, :message, :timestamp)
            """
            
            params = {
                'event_type': event_type,
                'event_data': event_data,
                'severity': 'ERROR' if event_type == 'ERROR' else 'INFO',
                'component': 'SystemStatusService',
                'message': f"{event_type}: {event_data.get('message', 'System event')}",
                'timestamp': datetime.utcnow()
            }
            
            async with self.dao.db.session() as session:
                from sqlalchemy import text
                await session.execute(text(query), params)
            
        except Exception as e:
            self.logger.debug(f"Failed to log system event: {e}")
    
    async def update_processing_status(self, symbol: str, phase: str):
        """Update current processing status and cache it"""
        try:
            self.set_processing_info(symbol, phase)
            
            # Cache the processing info
            processing_info = {
                'symbol': symbol,
                'phase': phase,
                'timestamp': datetime.utcnow().isoformat()
            }
            
            await self.dao.cache.set("system:current_processing", processing_info, ttl=300)
            
            # Log processing update
            await self._log_system_event("PROCESSING_UPDATE", processing_info)
            
        except Exception as e:
            self.logger.error(f"Failed to update processing status: {e}")
    
    async def _detect_system_status(self) -> str:
        """Auto-detect if the system is running based on recent activity"""
        try:
            # Check for recent AI decisions (indicates system is actively running)
            recent_time = datetime.utcnow() - timedelta(minutes=5)
            
            ai_decisions_query = """
            SELECT COUNT(*) as count FROM ai_decisions 
            WHERE timestamp >= :recent_time
            """
            
            result = await self.dao.db.execute_query(ai_decisions_query, {'recent_time': recent_time})
            recent_decisions = result[0]['count'] if result else 0
            
            # Check for recent market data updates
            market_data_query = """
            SELECT COUNT(*) as count FROM market_data 
            WHERE created_at >= :recent_time
            """
            
            result = await self.dao.db.execute_query(market_data_query, {'recent_time': recent_time})
            recent_market_data = result[0]['count'] if result else 0
            
            # Check for recent sentiment analysis
            sentiment_query = """
            SELECT COUNT(*) as count FROM sentiment_analysis 
            WHERE timestamp >= :recent_time
            """
            
            result = await self.dao.db.execute_query(sentiment_query, {'recent_time': recent_time})
            recent_sentiment = result[0]['count'] if result else 0
            
            # If we have recent activity, system is running
            if recent_decisions > 0 or recent_market_data > 0 or recent_sentiment > 0:
                return "RUNNING"
            
            # Check if we have any data at all (system has run before but might be idle)
            total_decisions_query = "SELECT COUNT(*) as count FROM ai_decisions"
            result = await self.dao.db.execute_query(total_decisions_query)
            total_decisions = result[0]['count'] if result else 0
            
            if total_decisions > 0:
                # System has data but no recent activity - might be idle but still running
                return "RUNNING"
            
            return "STOPPED"
            
        except Exception as e:
            self.logger.debug(f"Failed to detect system status: {e}")
            return "ERROR"
    
    async def _get_system_start_time(self) -> Optional[datetime]:
        """Get the system start time based on earliest recent activity"""
        try:
            # Look for the earliest AI decision in the last 24 hours
            recent_time = datetime.utcnow() - timedelta(hours=24)
            
            query = """
            SELECT MIN(timestamp) as start_time FROM ai_decisions 
            WHERE timestamp >= :recent_time
            """
            
            result = await self.dao.db.execute_query(query, {'recent_time': recent_time})
            if result and result[0]['start_time']:
                return result[0]['start_time']
            
            # Fallback to current time minus 1 hour if no recent data
            return datetime.utcnow() - timedelta(hours=1)
            
        except Exception as e:
            self.logger.debug(f"Failed to get system start time: {e}")
            return None

    async def get_system_performance_metrics(self) -> Dict[str, float]:
        """Get detailed system performance metrics"""
        try:
            # CPU metrics
            cpu_percent = psutil.cpu_percent(interval=1)
            cpu_count = psutil.cpu_count()
            
            # Memory metrics
            memory = psutil.virtual_memory()
            
            # Disk metrics
            disk = psutil.disk_usage('/')
            
            # Network metrics (if available)
            try:
                network = psutil.net_io_counters()
                network_sent = network.bytes_sent
                network_recv = network.bytes_recv
            except:
                network_sent = 0
                network_recv = 0
            
            return {
                'cpu_usage': round(cpu_percent, 1),
                'cpu_count': cpu_count,
                'memory_usage': round(memory.percent, 1),
                'memory_total': round(memory.total / (1024**3), 2),  # GB
                'memory_available': round(memory.available / (1024**3), 2),  # GB
                'disk_usage': round(disk.percent, 1),
                'disk_total': round(disk.total / (1024**3), 2),  # GB
                'disk_free': round(disk.free / (1024**3), 2),  # GB
                'network_sent': network_sent,
                'network_recv': network_recv
            }
            
        except Exception as e:
            self.logger.error(f"Failed to get performance metrics: {e}")
            return {
                'cpu_usage': 0.0,
                'cpu_count': 1,
                'memory_usage': 0.0,
                'memory_total': 0.0,
                'memory_available': 0.0,
                'disk_usage': 0.0,
                'disk_total': 0.0,
                'disk_free': 0.0,
                'network_sent': 0,
                'network_recv': 0
            }