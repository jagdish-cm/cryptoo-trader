-- Cleanup script to remove all data for symbols other than BTC/USDT and ETH/USDT

-- Show current symbol counts before cleanup
SELECT 'ai_decisions' as table_name, symbol, COUNT(*) as count 
FROM ai_decisions 
GROUP BY symbol 
ORDER BY symbol;

SELECT 'sentiment_analysis' as table_name, symbol, COUNT(*) as count 
FROM sentiment_analysis 
GROUP BY symbol 
ORDER BY symbol;

SELECT 'market_data_cache' as table_name, symbol, COUNT(*) as count 
FROM market_data_cache 
GROUP BY symbol 
ORDER BY symbol;

-- Clean up ai_decisions table
DELETE FROM ai_decisions 
WHERE symbol NOT IN ('BTC/USDT', 'ETH/USDT');

-- Clean up sentiment_analysis table
DELETE FROM sentiment_analysis 
WHERE symbol NOT IN ('BTC/USDT', 'ETH/USDT');

-- Clean up market_data_cache table
DELETE FROM market_data_cache 
WHERE symbol NOT IN ('BTC/USDT', 'ETH/USDT');

-- Clean up any other tables that might have symbol data
DELETE FROM market_data 
WHERE symbol NOT IN ('BTC/USDT', 'ETH/USDT');

DELETE FROM technical_indicators 
WHERE symbol NOT IN ('BTC/USDT', 'ETH/USDT');

DELETE FROM trading_signals 
WHERE symbol NOT IN ('BTC/USDT', 'ETH/USDT');

DELETE FROM positions 
WHERE symbol NOT IN ('BTC/USDT', 'ETH/USDT');

DELETE FROM trades 
WHERE symbol NOT IN ('BTC/USDT', 'ETH/USDT');

-- Show results after cleanup
SELECT 'AFTER CLEANUP - ai_decisions' as table_name, symbol, COUNT(*) as count 
FROM ai_decisions 
GROUP BY symbol 
ORDER BY symbol;

SELECT 'AFTER CLEANUP - sentiment_analysis' as table_name, symbol, COUNT(*) as count 
FROM sentiment_analysis 
GROUP BY symbol 
ORDER BY symbol;

SELECT 'AFTER CLEANUP - market_data_cache' as table_name, symbol, COUNT(*) as count 
FROM market_data_cache 
GROUP BY symbol 
ORDER BY symbol;

-- Show total counts
SELECT 'TOTAL RECORDS REMAINING' as info;
SELECT 'ai_decisions' as table_name, COUNT(*) as total_count FROM ai_decisions;
SELECT 'sentiment_analysis' as table_name, COUNT(*) as total_count FROM sentiment_analysis;
SELECT 'market_data_cache' as table_name, COUNT(*) as total_count FROM market_data_cache;
SELECT 'market_data' as table_name, COUNT(*) as total_count FROM market_data;
SELECT 'technical_indicators' as table_name, COUNT(*) as total_count FROM technical_indicators;
SELECT 'trading_signals' as table_name, COUNT(*) as total_count FROM trading_signals;
SELECT 'positions' as table_name, COUNT(*) as total_count FROM positions;
SELECT 'trades' as table_name, COUNT(*) as total_count FROM trades;