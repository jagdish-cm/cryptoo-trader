#!/usr/bin/env python3
"""
Populate execution threshold test data
This will create sample AI decisions with execution threshold analysis
"""

import asyncio
import sys
import os
import json
import uuid
from datetime import datetime, timedelta
import random

# Add parent directory to path
sys.path.append(os.path.join(os.path.dirname(__file__), '../..'))

from ai_trading_system.config.settings import load_config
from ai_trading_system.services.data_storage import DatabaseConnection
from ai_trading_system.utils.logging import get_logger

logger = get_logger("populate_execution_threshold_data")

async def populate_test_data():
    """Populate test data for execution threshold analysis"""
    
    config = load_config()
    db = DatabaseConnection(config.database)
    await db.connect()
    
    try:
        # Sample symbols
        symbols = ['BTC/USDT', 'ETH/USDT']
        decision_types = ['BUY_SIGNAL', 'SELL_SIGNAL', 'HOLD_SIGNAL']
        
        # Generate 50 sample AI decisions with execution threshold data
        for i in range(50):
            # Generate random scores
            confidence = random.uniform(0.3, 0.95)
            technical_score = random.uniform(0.2, 0.9)
            sentiment_score = random.uniform(0.1, 0.8)
            event_impact = random.uniform(0.0, 0.7)
            
            # Calculate fusion score (weighted combination)
            fusion_score = (technical_score * 0.6) + (sentiment_score * 0.4)
            
            # Calculate risk score (inverse of confidence with some randomness)
            risk_score = (1.0 - confidence) * random.uniform(0.8, 1.2)
            risk_score = min(1.0, max(0.0, risk_score))
            
            # Volume score (simulated)
            volume_score = random.uniform(0.2, 0.8)
            
            # Get current thresholds (use range market defaults)
            thresholds = {
                'min_confidence': 0.6,
                'min_technical_score': 0.5,
                'min_sentiment_score': 0.4,
                'min_fusion_score': 0.6,
                'max_risk_score': 0.8,
                'min_volume_score': 0.3
            }
            
            # Determine execution decision based on thresholds
            rejection_reasons = []
            
            if confidence < thresholds['min_confidence']:
                rejection_reasons.append(f"Low confidence: {confidence:.1%} < {thresholds['min_confidence']:.1%}")
            
            if technical_score < thresholds['min_technical_score']:
                rejection_reasons.append(f"Weak technical: {technical_score:.1%} < {thresholds['min_technical_score']:.1%}")
            
            if sentiment_score < thresholds['min_sentiment_score']:
                rejection_reasons.append(f"Poor sentiment: {sentiment_score:.1%} < {thresholds['min_sentiment_score']:.1%}")
            
            if fusion_score < thresholds['min_fusion_score']:
                rejection_reasons.append(f"Low fusion score: {fusion_score:.1%} < {thresholds['min_fusion_score']:.1%}")
            
            if risk_score > thresholds['max_risk_score']:
                rejection_reasons.append(f"High risk: {risk_score:.1%} > {thresholds['max_risk_score']:.1%}")
            
            if volume_score < thresholds['min_volume_score']:
                rejection_reasons.append(f"Low volume: {volume_score:.1%} < {thresholds['min_volume_score']:.1%}")
            
            # Execution decision
            should_execute = len(rejection_reasons) == 0
            execution_decision = 'EXECUTED' if should_execute else 'REJECTED'
            
            # Calculate execution probability
            margins = {
                'confidence': confidence - thresholds['min_confidence'],
                'technical': technical_score - thresholds['min_technical_score'],
                'sentiment': sentiment_score - thresholds['min_sentiment_score'],
                'fusion': fusion_score - thresholds['min_fusion_score'],
                'risk': thresholds['max_risk_score'] - risk_score,
                'volume': volume_score - thresholds['min_volume_score']
            }
            
            # Calculate execution probability based on margins
            probabilities = []
            for margin in margins.values():
                if margin >= 0:
                    prob = min(1.0, 0.5 + (margin * 2))
                else:
                    prob = max(0.0, 0.5 + (margin * 2))
                probabilities.append(prob)
            
            execution_probability = sum(probabilities) / len(probabilities)
            
            # Score vs thresholds comparison
            score_vs_thresholds = {
                'confidence': {
                    'score': confidence,
                    'threshold': thresholds['min_confidence'],
                    'passed': confidence >= thresholds['min_confidence'],
                    'margin': margins['confidence']
                },
                'technical': {
                    'score': technical_score,
                    'threshold': thresholds['min_technical_score'],
                    'passed': technical_score >= thresholds['min_technical_score'],
                    'margin': margins['technical']
                },
                'sentiment': {
                    'score': sentiment_score,
                    'threshold': thresholds['min_sentiment_score'],
                    'passed': sentiment_score >= thresholds['min_sentiment_score'],
                    'margin': margins['sentiment']
                },
                'fusion': {
                    'score': fusion_score,
                    'threshold': thresholds['min_fusion_score'],
                    'passed': fusion_score >= thresholds['min_fusion_score'],
                    'margin': margins['fusion']
                },
                'risk': {
                    'score': risk_score,
                    'threshold': thresholds['max_risk_score'],
                    'passed': risk_score <= thresholds['max_risk_score'],
                    'margin': margins['risk']
                },
                'volume': {
                    'score': volume_score,
                    'threshold': thresholds['min_volume_score'],
                    'passed': volume_score >= thresholds['min_volume_score'],
                    'margin': margins['volume']
                }
            }
            
            # Threshold analysis
            threshold_analysis = {
                'risk_assessment': 'LOW' if execution_probability > 0.8 else 'MEDIUM' if execution_probability > 0.6 else 'HIGH',
                'threshold_margins': margins,
                'strategy_mode': 'dual_mode',
                'market_regime': 'range'
            }
            
            # Generate outcome based on execution decision
            if should_execute:
                outcome = {
                    'action': 'TRADE_EXECUTED',
                    'result': 'SUCCESS' if random.random() > 0.3 else 'PARTIAL',
                    'details': 'Trade executed successfully' if random.random() > 0.3 else 'Partial execution due to market conditions'
                }
            else:
                outcome = {
                    'action': 'NO_ACTION',
                    'result': 'REJECTED',
                    'details': 'Trade rejected due to threshold violations'
                }
            
            # Insert AI decision with execution threshold data
            decision_data = {
                'id': str(uuid.uuid4()),
                'timestamp': datetime.utcnow() - timedelta(hours=random.randint(0, 168)),  # Last 7 days
                'decision_type': random.choice(decision_types),
                'symbol': random.choice(symbols),
                'confidence': confidence,
                'technical_score': technical_score,
                'sentiment_score': sentiment_score,
                'event_impact': event_impact,
                'final_confidence': confidence,
                'risk_factors': json.dumps(['market_volatility', 'low_volume'] if risk_score > 0.6 else ['normal_conditions']),
                'reasoning': json.dumps({
                    'technical_indicators': ['RSI_oversold', 'MACD_bullish'] if technical_score > 0.6 else ['RSI_neutral'],
                    'sentiment_factors': ['positive_news', 'social_sentiment'] if sentiment_score > 0.5 else ['neutral_sentiment'],
                    'market_conditions': 'favorable' if confidence > 0.7 else 'uncertain'
                }),
                'factors': json.dumps(['price_momentum', 'volume_analysis', 'sentiment_analysis']),
                'outcome': json.dumps(outcome),
                'min_confidence_threshold': thresholds['min_confidence'],
                'min_technical_threshold': thresholds['min_technical_score'],
                'min_sentiment_threshold': thresholds['min_sentiment_score'],
                'min_fusion_score': thresholds['min_fusion_score'],
                'execution_decision': execution_decision,
                'rejection_reasons': rejection_reasons,
                'threshold_analysis': json.dumps(threshold_analysis),
                'score_vs_thresholds': json.dumps(score_vs_thresholds),
                'execution_probability': execution_probability
            }
            
            insert_query = """
            INSERT INTO ai_decisions (
                id, timestamp, decision_type, symbol, confidence, technical_score, 
                sentiment_score, event_impact, final_confidence, risk_factors, 
                reasoning, factors, outcome, min_confidence_threshold, 
                min_technical_threshold, min_sentiment_threshold, min_fusion_score,
                execution_decision, rejection_reasons, threshold_analysis,
                score_vs_thresholds, execution_probability
            ) VALUES (
                :id, :timestamp, :decision_type, :symbol, :confidence, :technical_score,
                :sentiment_score, :event_impact, :final_confidence, :risk_factors,
                :reasoning, :factors, :outcome, :min_confidence_threshold,
                :min_technical_threshold, :min_sentiment_threshold, :min_fusion_score,
                :execution_decision, :rejection_reasons, :threshold_analysis,
                :score_vs_thresholds, :execution_probability
            )
            """
            
            await db.execute_non_query(insert_query, decision_data)
            
            if i % 10 == 0:
                logger.info(f"Inserted {i+1} AI decisions with execution threshold data")
        
        logger.info("✅ Successfully populated 50 AI decisions with execution threshold data!")
        
        # Show summary statistics
        summary_query = """
        SELECT 
            execution_decision,
            COUNT(*) as count,
            AVG(confidence) as avg_confidence,
            AVG(execution_probability) as avg_execution_prob
        FROM ai_decisions 
        WHERE execution_decision IS NOT NULL
        GROUP BY execution_decision
        """
        
        summary_result = await db.execute_query(summary_query)
        
        logger.info("📊 Summary Statistics:")
        for row in summary_result:
            avg_confidence = float(row['avg_confidence']) if row['avg_confidence'] else 0.0
            avg_execution_prob = float(row['avg_execution_prob']) if row['avg_execution_prob'] else 0.0
            logger.info(f"  {row['execution_decision']}: {row['count']} decisions, "
                       f"Avg Confidence: {avg_confidence:.1%}, "
                       f"Avg Execution Prob: {avg_execution_prob:.1%}")
        
    except Exception as e:
        logger.error(f"Error populating execution threshold data: {e}")
        raise
    finally:
        await db.disconnect()

if __name__ == "__main__":
    asyncio.run(populate_test_data())