"""
AI Decision Logger - Captures and logs actual AI decisions to database
This service logs real AI decisions as they happen in the trading system
"""

import asyncio
import json
from typing import Dict, List, Optional, Any
from datetime import datetime
from uuid import uuid4

from ai_trading_system.services.data_storage import DataAccessObject
from ai_trading_system.utils.logging import get_logger


class AIDecisionLogger:
    """Service for logging actual AI decisions to database"""
    
    def __init__(self, dao: DataAccessObject):
        self.dao = dao
        self.logger = get_logger("ai_decision_logger")
    
    async def log_decision(
        self,
        decision_type: str,
        symbol: str,
        confidence: float,
        technical_score: float = None,
        sentiment_score: float = None,
        event_impact: float = None,
        reasoning: Dict[str, Any] = None,
        factors: List[Dict[str, Any]] = None,
        outcome: Dict[str, Any] = None,
        metadata: Dict[str, Any] = None
    ) -> str:
        """Log an AI decision to the database"""
        try:
            decision_id = str(uuid4())
            
            # Prepare decision data with JSON serialization
            decision_data = {
                'id': decision_id,
                'timestamp': datetime.utcnow(),
                'decision_type': decision_type,
                'symbol': symbol,
                'confidence': min(1.0, max(0.0, confidence)),  # Clamp between 0-1
                'technical_score': technical_score,
                'sentiment_score': sentiment_score,
                'event_impact': event_impact or 0.0,
                'final_confidence': confidence,
                'risk_factors': json.dumps(reasoning.get('risk_factors', []) if reasoning else []),
                'reasoning': json.dumps(reasoning or {}),
                'factors': json.dumps(factors or []),
                'outcome': json.dumps(outcome or {
                    'action': 'PENDING',
                    'result': 'PENDING',
                    'details': 'Decision logged, outcome pending'
                }),
                'metadata': json.dumps(metadata or {})
            }
            
            # Insert into database
            query = """
            INSERT INTO ai_decisions (
                id, timestamp, decision_type, symbol, confidence,
                technical_score, sentiment_score, event_impact, final_confidence,
                risk_factors, reasoning, factors, outcome, metadata
            ) VALUES (
                :id, :timestamp, :decision_type, :symbol, :confidence,
                :technical_score, :sentiment_score, :event_impact, :final_confidence,
                :risk_factors, :reasoning, :factors, :outcome, :metadata
            )
            """
            
            async with self.dao.db.session() as session:
                from sqlalchemy import text
                await session.execute(text(query), decision_data)
            
            self.logger.info(f"AI decision logged: {decision_type} for {symbol} "
                           f"with confidence {confidence:.3f}")
            
            return decision_id
            
        except Exception as e:
            self.logger.error(f"Failed to log AI decision: {e}")
            return None
    
    async def log_signal_generation(
        self,
        symbol: str,
        direction: str,
        confidence: float,
        technical_score: float,
        sentiment_score: float,
        setup_type: str,
        reasoning: str = None
    ) -> str:
        """Log a signal generation decision"""
        factors = [
            {
                'type': 'Technical Analysis',
                'value': technical_score,
                'weight': 0.6,
                'description': f'Technical indicators for {setup_type}'
            },
            {
                'type': 'Sentiment Analysis',
                'value': sentiment_score,
                'weight': 0.3,
                'description': 'Market sentiment analysis'
            }
        ]
        
        reasoning_data = {
            'direction': direction,
            'setup_type': setup_type,
            'reasoning': reasoning or f'{setup_type} setup detected',
            'risk_factors': self._assess_risk_factors(confidence, technical_score, sentiment_score)
        }
        
        outcome = {
            'action': f'GENERATE_{direction}_SIGNAL',
            'result': 'SUCCESS',
            'details': f'{direction} signal generated for {setup_type} setup'
        }
        
        return await self.log_decision(
            decision_type='SIGNAL_GENERATION',
            symbol=symbol,
            confidence=confidence,
            technical_score=technical_score,
            sentiment_score=sentiment_score,
            reasoning=reasoning_data,
            factors=factors,
            outcome=outcome
        )
    
    async def log_risk_validation(
        self,
        symbol: str,
        risk_score: float,
        position_size: float,
        stop_loss: float,
        take_profit: float,
        validation_result: str
    ) -> str:
        """Log a risk validation decision"""
        factors = [
            {
                'type': 'Position Sizing',
                'value': position_size,
                'weight': 0.4,
                'description': 'Calculated position size based on risk tolerance'
            },
            {
                'type': 'Risk/Reward Ratio',
                'value': (take_profit - stop_loss) / stop_loss if stop_loss > 0 else 0,
                'weight': 0.6,
                'description': 'Risk to reward ratio analysis'
            }
        ]
        
        reasoning_data = {
            'risk_score': risk_score,
            'position_size': position_size,
            'stop_loss': stop_loss,
            'take_profit': take_profit,
            'risk_factors': ['Position sizing', 'Market volatility', 'Liquidity risk']
        }
        
        outcome = {
            'action': 'RISK_VALIDATED' if validation_result == 'APPROVED' else 'RISK_REJECTED',
            'result': validation_result,
            'details': f'Risk validation {validation_result.lower()} for {symbol}'
        }
        
        return await self.log_decision(
            decision_type='RISK_VALIDATION',
            symbol=symbol,
            confidence=1.0 - risk_score,  # Lower risk = higher confidence
            reasoning=reasoning_data,
            factors=factors,
            outcome=outcome
        )
    
    async def log_trade_execution(
        self,
        symbol: str,
        action: str,
        quantity: float,
        price: float,
        execution_result: str,
        execution_details: str = None
    ) -> str:
        """Log a trade execution decision"""
        factors = [
            {
                'type': 'Market Conditions',
                'value': 0.8,  # This would come from actual market analysis
                'weight': 0.5,
                'description': 'Current market liquidity and volatility'
            },
            {
                'type': 'Timing Analysis',
                'value': 0.7,  # This would come from timing analysis
                'weight': 0.5,
                'description': 'Optimal execution timing assessment'
            }
        ]
        
        reasoning_data = {
            'action': action,
            'quantity': quantity,
            'price': price,
            'execution_strategy': 'MARKET_ORDER',  # This would be dynamic
            'risk_factors': ['Slippage risk', 'Market impact', 'Timing risk']
        }
        
        outcome = {
            'action': f'EXECUTE_{action}',
            'result': execution_result,
            'details': execution_details or f'{action} order executed for {quantity} {symbol} at {price}'
        }
        
        return await self.log_decision(
            decision_type='TRADE_EXECUTION',
            symbol=symbol,
            confidence=0.9 if execution_result == 'SUCCESS' else 0.3,
            reasoning=reasoning_data,
            factors=factors,
            outcome=outcome
        )
    
    async def log_position_management(
        self,
        symbol: str,
        action: str,
        current_pnl: float,
        decision_reason: str,
        management_result: str
    ) -> str:
        """Log a position management decision"""
        factors = [
            {
                'type': 'P&L Analysis',
                'value': min(1.0, max(0.0, (current_pnl + 100) / 200)),  # Normalize P&L to 0-1
                'weight': 0.6,
                'description': 'Current position profit/loss analysis'
            },
            {
                'type': 'Market Conditions',
                'value': 0.7,  # This would come from market analysis
                'weight': 0.4,
                'description': 'Current market trend and volatility'
            }
        ]
        
        reasoning_data = {
            'action': action,
            'current_pnl': current_pnl,
            'decision_reason': decision_reason,
            'risk_factors': ['Market reversal risk', 'Volatility increase', 'Liquidity concerns']
        }
        
        outcome = {
            'action': f'POSITION_{action}',
            'result': management_result,
            'details': f'Position {action.lower()} for {symbol}: {decision_reason}'
        }
        
        confidence = 0.8 if current_pnl > 0 else 0.6  # Higher confidence for profitable positions
        
        return await self.log_decision(
            decision_type='POSITION_MANAGEMENT',
            symbol=symbol,
            confidence=confidence,
            reasoning=reasoning_data,
            factors=factors,
            outcome=outcome
        )
    
    def _assess_risk_factors(self, confidence: float, technical_score: float, sentiment_score: float) -> List[str]:
        """Assess risk factors based on decision parameters"""
        risk_factors = []
        
        if confidence < 0.7:
            risk_factors.append('Low confidence signal')
        
        if technical_score and technical_score < 0.6:
            risk_factors.append('Weak technical indicators')
        
        if sentiment_score and sentiment_score < 0.5:
            risk_factors.append('Negative market sentiment')
        
        if abs(technical_score - sentiment_score) > 0.3 if technical_score and sentiment_score else False:
            risk_factors.append('Technical-sentiment divergence')
        
        # Add general market risk factors
        risk_factors.extend(['Market volatility', 'Liquidity risk'])
        
        return risk_factors
    
    async def update_decision_outcome(
        self,
        decision_id: str,
        outcome: Dict[str, Any]
    ) -> bool:
        """Update the outcome of a previously logged decision"""
        try:
            query = """
            UPDATE ai_decisions 
            SET outcome = :outcome
            WHERE id = :decision_id
            """
            
            async with self.dao.db.session() as session:
                from sqlalchemy import text
                result = await session.execute(text(query), {
                    'decision_id': decision_id,
                    'outcome': outcome
                })
            
            self.logger.info(f"Updated outcome for decision {decision_id}")
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to update decision outcome: {e}")
            return False
    
    async def get_decision_statistics(self, days: int = 30) -> Dict[str, Any]:
        """Get statistics about AI decisions for performance metrics"""
        try:
            from datetime import timedelta
            
            start_date = datetime.utcnow() - timedelta(days=days)
            
            # Get decision counts by type and result
            query = """
            SELECT 
                decision_type,
                COUNT(*) as total_decisions,
                AVG(confidence) as avg_confidence,
                COUNT(CASE WHEN outcome->>'result' = 'SUCCESS' THEN 1 END) as successful_decisions,
                COUNT(CASE WHEN outcome->>'result' = 'FAILURE' THEN 1 END) as failed_decisions
            FROM ai_decisions
            WHERE timestamp >= :start_date
            GROUP BY decision_type
            """
            
            results = await self.dao.db.execute_query(query, {'start_date': start_date})
            
            # Calculate overall statistics
            total_decisions = sum(row['total_decisions'] for row in results)
            total_successful = sum(row['successful_decisions'] for row in results)
            
            success_rate = (total_successful / total_decisions * 100) if total_decisions > 0 else 0
            avg_confidence = sum(row['avg_confidence'] * row['total_decisions'] for row in results) / total_decisions if total_decisions > 0 else 0
            
            # Calculate processing time statistics
            processing_query = """
            SELECT AVG(EXTRACT(EPOCH FROM (
                CASE 
                    WHEN outcome->>'timestamp' IS NOT NULL 
                    THEN (outcome->>'timestamp')::timestamp - timestamp
                    ELSE INTERVAL '1 second'
                END
            ))) as avg_processing_time
            FROM ai_decisions
            WHERE timestamp >= :start_date
            """
            
            processing_result = await self.dao.db.execute_query(processing_query, {'start_date': start_date})
            avg_processing_time = processing_result[0]['avg_processing_time'] if processing_result else 1.0
            
            statistics = {
                'total_decisions': total_decisions,
                'success_rate': round(success_rate, 1),
                'avg_confidence': round(avg_confidence, 3),
                'avg_processing_time': round(avg_processing_time, 2),
                'decision_breakdown': {
                    row['decision_type']: {
                        'total': row['total_decisions'],
                        'success_rate': round((row['successful_decisions'] / row['total_decisions'] * 100) if row['total_decisions'] > 0 else 0, 1),
                        'avg_confidence': round(row['avg_confidence'], 3)
                    }
                    for row in results
                }
            }
            
            return statistics
            
        except Exception as e:
            self.logger.error(f"Failed to get decision statistics: {e}")
            return {
                'total_decisions': 0,
                'success_rate': 0.0,
                'avg_confidence': 0.0,
                'avg_processing_time': 0.0,
                'decision_breakdown': {}
            }