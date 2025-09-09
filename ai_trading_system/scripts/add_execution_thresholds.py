#!/usr/bin/env python3
"""
Add execution threshold tracking to the database
This will help track why trades were or weren't executed
"""

import asyncio
import sys
import os

# Add parent directory to path
sys.path.append(os.path.join(os.path.dirname(__file__), '../..'))

from ai_trading_system.config.settings import load_config
from ai_trading_system.services.data_storage import DatabaseConnection
from ai_trading_system.utils.logging import get_logger

logger = get_logger("add_execution_thresholds")

async def add_execution_threshold_columns():
    """Add execution threshold tracking columns to ai_decisions table"""
    
    config = load_config()
    db = DatabaseConnection(config.database)
    await db.connect()
    
    try:
        # Add new columns to ai_decisions table
        alter_queries = [
            # Execution thresholds
            "ALTER TABLE ai_decisions ADD COLUMN IF NOT EXISTS min_confidence_threshold DECIMAL(5,3) DEFAULT 0.6",
            "ALTER TABLE ai_decisions ADD COLUMN IF NOT EXISTS min_technical_threshold DECIMAL(5,3) DEFAULT 0.5", 
            "ALTER TABLE ai_decisions ADD COLUMN IF NOT EXISTS min_sentiment_threshold DECIMAL(5,3) DEFAULT 0.4",
            "ALTER TABLE ai_decisions ADD COLUMN IF NOT EXISTS min_fusion_score DECIMAL(5,3) DEFAULT 0.6",
            
            # Execution decision tracking
            "ALTER TABLE ai_decisions ADD COLUMN IF NOT EXISTS execution_decision VARCHAR(20) DEFAULT 'PENDING'", # EXECUTED, REJECTED, PENDING
            "ALTER TABLE ai_decisions ADD COLUMN IF NOT EXISTS rejection_reasons TEXT[]",
            "ALTER TABLE ai_decisions ADD COLUMN IF NOT EXISTS threshold_analysis JSONB",
            
            # Score comparisons
            "ALTER TABLE ai_decisions ADD COLUMN IF NOT EXISTS score_vs_thresholds JSONB",
            "ALTER TABLE ai_decisions ADD COLUMN IF NOT EXISTS execution_probability DECIMAL(5,3)"
        ]
        
        for query in alter_queries:
            try:
                await db.execute_non_query(query)
                logger.info(f"Executed: {query[:50]}...")
            except Exception as e:
                if "already exists" in str(e).lower():
                    logger.info(f"Column already exists, skipping: {query[:50]}...")
                else:
                    logger.error(f"Error executing query: {e}")
        
        # Create execution thresholds configuration table
        create_thresholds_table = """
        CREATE TABLE IF NOT EXISTS execution_thresholds (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            strategy_mode VARCHAR(50) NOT NULL,
            market_regime VARCHAR(50) NOT NULL,
            min_confidence DECIMAL(5,3) NOT NULL DEFAULT 0.6,
            min_technical_score DECIMAL(5,3) NOT NULL DEFAULT 0.5,
            min_sentiment_score DECIMAL(5,3) NOT NULL DEFAULT 0.4,
            min_fusion_score DECIMAL(5,3) NOT NULL DEFAULT 0.6,
            max_risk_score DECIMAL(5,3) NOT NULL DEFAULT 0.8,
            min_volume_score DECIMAL(5,3) NOT NULL DEFAULT 0.3,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            is_active BOOLEAN DEFAULT TRUE,
            performance_metrics JSONB,
            UNIQUE(strategy_mode, market_regime)
        )
        """
        
        await db.execute_non_query(create_thresholds_table)
        logger.info("Created execution_thresholds table")
        
        # Insert default thresholds for different market regimes
        default_thresholds = [
            {
                'strategy_mode': 'dual_mode',
                'market_regime': 'trending',
                'min_confidence': 0.7,
                'min_technical_score': 0.6,
                'min_sentiment_score': 0.5,
                'min_fusion_score': 0.65,
                'max_risk_score': 0.7,
                'min_volume_score': 0.4
            },
            {
                'strategy_mode': 'dual_mode', 
                'market_regime': 'range',
                'min_confidence': 0.6,
                'min_technical_score': 0.5,
                'min_sentiment_score': 0.4,
                'min_fusion_score': 0.6,
                'max_risk_score': 0.8,
                'min_volume_score': 0.3
            },
            {
                'strategy_mode': 'dual_mode',
                'market_regime': 'volatile', 
                'min_confidence': 0.8,
                'min_technical_score': 0.7,
                'min_sentiment_score': 0.6,
                'min_fusion_score': 0.75,
                'max_risk_score': 0.6,
                'min_volume_score': 0.5
            }
        ]
        
        for threshold in default_thresholds:
            insert_query = """
            INSERT INTO execution_thresholds (
                strategy_mode, market_regime, min_confidence, min_technical_score,
                min_sentiment_score, min_fusion_score, max_risk_score, min_volume_score
            ) VALUES (
                :strategy_mode, :market_regime, :min_confidence, :min_technical_score,
                :min_sentiment_score, :min_fusion_score, :max_risk_score, :min_volume_score
            ) ON CONFLICT (strategy_mode, market_regime) DO NOTHING
            """
            
            await db.execute_non_query(insert_query, threshold)
        
        logger.info("Inserted default execution thresholds")
        
        # Create indexes for better performance
        index_queries = [
            "CREATE INDEX IF NOT EXISTS idx_ai_decisions_execution ON ai_decisions(execution_decision, timestamp DESC)",
            "CREATE INDEX IF NOT EXISTS idx_ai_decisions_thresholds ON ai_decisions(min_confidence_threshold, confidence)",
            "CREATE INDEX IF NOT EXISTS idx_execution_thresholds_active ON execution_thresholds(strategy_mode, market_regime, is_active)"
        ]
        
        for query in index_queries:
            await db.execute_non_query(query)
            logger.info(f"Created index: {query[32:60]}...")
        
        logger.info("✅ Execution threshold tracking added successfully!")
        
    except Exception as e:
        logger.error(f"Error adding execution thresholds: {e}")
        raise
    finally:
        await db.disconnect()

if __name__ == "__main__":
    asyncio.run(add_execution_threshold_columns())