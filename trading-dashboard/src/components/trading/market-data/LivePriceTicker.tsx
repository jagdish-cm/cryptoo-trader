import React, { useState, useEffect } from "react";
import { ArrowUpIcon, ArrowDownIcon } from "@heroicons/react/24/solid";

interface PriceData {
  symbol: string;
  price: number;
  change24h?: number | null;
  volume24h?: number | null;
}

interface LivePriceTickerProps {
  symbols?: string[];
}

const LivePriceTicker: React.FC<LivePriceTickerProps> = ({
  symbols = ["BTC/USDT", "ETH/USDT"],
}) => {
  const [priceData, setPriceData] = useState<Record<string, PriceData>>({});
  const [priceChanges, setPriceChanges] = useState<
    Record<string, "up" | "down" | null>
  >({});

  useEffect(() => {
    const fetchPrices = async () => {
      try {
        // First try to get cached prices from AI analysis service
        const cachedResponse = await fetch(
          `http://localhost:8000/api/analysis/cached-prices?symbols=${symbols.join(",")}`
        );
        let data: Record<string, any> = {};

        if (cachedResponse.ok) {
          const cachedData = await cachedResponse.json();
          data = cachedData.prices || {};

          // If we don't have cached data for all symbols, fall back to market API (less frequently)
          const missingSymbols = symbols.filter((symbol) => !data[symbol]);
          if (missingSymbols.length > 0) {
            // Only fetch missing symbols and do it less frequently
            const marketResponse = await fetch(
              `http://localhost:8000/api/market/data?symbols=${missingSymbols.join(",")}`
            );
            if (marketResponse.ok) {
              const marketData = await marketResponse.json();
              data = { ...data, ...marketData };
            }
          }
        } else {
          // Fallback to market API if cached prices not available
          const response = await fetch(
            `http://localhost:8000/api/market/data?symbols=${symbols.join(",")}`
          );
          if (response.ok) {
            data = await response.json();
          }
        }

        // Track price changes for animations
        const newPriceChanges: Record<string, "up" | "down" | null> = {};

        Object.entries(data).forEach(([symbol, newData]: [string, unknown]) => {
          const oldPrice = priceData[symbol]?.price;
          if (oldPrice && newData?.price && newData.price !== oldPrice) {
            newPriceChanges[symbol] = newData.price > oldPrice ? "up" : "down";
          }
        });

        setPriceChanges(newPriceChanges);
        setPriceData(data);

        // Clear price change indicators after animation
        setTimeout(() => {
          setPriceChanges({});
        }, 1000);
      } catch (error) {
        console.error("Error fetching price data:", error);
      }
    };

    fetchPrices();
    // Reduced frequency - update every 15 seconds instead of 2 seconds
    const interval = setInterval(fetchPrices, 15000);

    return () => clearInterval(interval);
  }, [symbols.join(",")]);

  const formatPrice = (price: number | undefined | null) => {
    if (price === undefined || price === null || isNaN(price)) {
      return "0.00";
    }
    if (price >= 1000) {
      return `$${price.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    } else if (price >= 1) {
      return `$${price.toFixed(2)}`;
    } else {
      return `$${price.toFixed(4)}`;
    }
  };

  const formatChange = (change: number | undefined | null) => {
    if (change === undefined || change === null || isNaN(change)) {
      return "0.00%";
    }
    return `${change >= 0 ? "+" : ""}${change.toFixed(2)}%`;
  };

  return (
    <div className='bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden'>
      <div className='px-4 py-3 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600'>
        <h3 className='text-sm font-medium text-gray-900 dark:text-white flex items-center'>
          <div className='w-2 h-2 bg-green-500 rounded-full animate-pulse mr-2'></div>
          Live Prices
        </h3>
      </div>

      <div className='divide-y divide-gray-200 dark:divide-gray-700'>
        {symbols.map((symbol) => {
          const data = priceData[symbol];
          const priceChange = priceChanges[symbol];

          if (!data) {
            return (
              <div key={symbol} className='px-4 py-3 animate-pulse'>
                <div className='flex justify-between items-center'>
                  <div className='h-4 bg-gray-300 dark:bg-gray-600 rounded w-16'></div>
                  <div className='h-4 bg-gray-300 dark:bg-gray-600 rounded w-20'></div>
                </div>
              </div>
            );
          }

          return (
            <div
              key={symbol}
              className={`px-4 py-3 transition-colors duration-300 ${
                priceChange === "up"
                  ? "bg-green-50 dark:bg-green-900/20"
                  : priceChange === "down"
                    ? "bg-red-50 dark:bg-red-900/20"
                    : ""
              }`}
            >
              <div className='flex justify-between items-center'>
                <div className='flex items-center space-x-2'>
                  <span className='text-sm font-medium text-gray-900 dark:text-white'>
                    {symbol.replace("/USDT", "")}
                  </span>
                  {priceChange && (
                    <div
                      className={`transition-opacity duration-300 ${priceChange ? "opacity-100" : "opacity-0"}`}
                    >
                      {priceChange === "up" ? (
                        <ArrowUpIcon className='h-3 w-3 text-green-500' />
                      ) : (
                        <ArrowDownIcon className='h-3 w-3 text-red-500' />
                      )}
                    </div>
                  )}
                </div>

                <div className='text-right'>
                  <div
                    className={`text-sm font-medium transition-colors duration-300 ${
                      priceChange === "up"
                        ? "text-green-600 dark:text-green-400"
                        : priceChange === "down"
                          ? "text-red-600 dark:text-red-400"
                          : "text-gray-900 dark:text-white"
                    }`}
                  >
                    {formatPrice(data.price)}
                  </div>
                  <div
                    className={`text-xs ${
                      (data.change24h ?? 0) >= 0
                        ? "text-green-600 dark:text-green-400"
                        : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {formatChange(data.change24h)}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default LivePriceTicker;
