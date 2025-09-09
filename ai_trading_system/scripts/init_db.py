"""
Database initialization script
"""

import asyncio
import sys
from pathlib import Path

# Add the project root to Python path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from ai_trading_system.config.settings import load_config
from ai_trading_system.services.data_storage import DatabaseConnection
from ai_trading_system.utils.logging import get_logger


async def init_database():
    """Initialize the database with required tables"""
    logger = get_logger("init_db")
    
    try:
        # Load configuration
        config = load_config()
        
        if not config.database:
            logger.error("Database configuration not found. Please set DB_* environment variables.")
            return False
        
        logger.info("Initializing database", {
            "host": config.database.host,
            "port": config.database.port,
            "database": config.database.database
        })
        
        # Create database connection
        db = DatabaseConnection(config.database)
        
        # Connect to database
        await db.connect()
        logger.info("Connected to database successfully")
        
        # Create tables
        await db.create_tables()
        logger.info("Database tables created successfully")
        
        # Disconnect
        await db.disconnect()
        logger.info("Database initialization completed")
        
        return True
        
    except Exception as e:
        logger.error("Database initialization failed", {"error": str(e)})
        return False


def main():
    """Main entry point"""
    print("🚀 Initializing AI Trading System Database...")
    
    success = asyncio.run(init_database())
    
    if success:
        print("✅ Database initialization completed successfully!")
        print("\nNext steps:")
        print("1. Start Redis: brew services start redis")
        print("2. Copy .env.example to .env and configure your API keys")
        print("3. Run the system: python -m ai_trading_system.main")
    else:
        print("❌ Database initialization failed. Check the logs above.")
        sys.exit(1)


if __name__ == "__main__":
    main()