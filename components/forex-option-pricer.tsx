'use client'

import React, { useState, useCallback } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer 
} from 'recharts'
import { Info } from 'lucide-react'

type ChartDataPoint = {
  strike: number;
  call: number;
  put: number;
}

export function ForexOptionPricer() {
  const [baseCurrency, setBaseCurrency] = useState<string>('USD')
  const [quoteCurrency, setQuoteCurrency] = useState<string>('JPY')
  const [exchangeRate, setExchangeRate] = useState<string>('110')
  const [K, setK] = useState<string>('110')
  const [T, setT] = useState<string>('1')
  const [r, setR] = useState<string>('0.05')
  const [lowExchange, setLowExchange] = useState<string>('105')
  const [highExchange, setHighExchange] = useState<string>('115')
  const [chartData, setChartData] = useState<ChartDataPoint[]>([])
  const [showChart, setShowChart] = useState<boolean>(false)
  const [calculatedSigma, setCalculatedSigma] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleNumberInput = (value: string, setter: React.Dispatch<React.SetStateAction<string>>) => {
    if (value === '' || value === '-') {
      setter(value)
    } else {
      const number = parseFloat(value)
      if (!isNaN(number)) {
        setter(value)
      }
    }
  }

  const calculateVolatility = useCallback((low: number, high: number, S: number, T: number): number => {
    if (low <= 0 || high <= 0 || S <= 0 || T <= 0) {
      throw new Error("為替レートと期間は正の値である必要があります。")
    }
    return Math.log(high / low) / (2 * Math.sqrt(T))
  }, [])

  const normalCDF = useCallback((x: number): number => {
    const t = 1 / (1 + 0.2316419 * Math.abs(x))
    const d = 0.3989423 * Math.exp(-x * x / 2)
    let prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))
    if (x > 0) prob = 1 - prob
    return prob
  }, [])

  const calculatePrices = useCallback(() => {
    try {
      setError(null)
      const RValue = parseFloat(exchangeRate)
      const KValue = parseFloat(K)
      const TValue = parseFloat(T)
      const rValue = parseFloat(r)
      const lowExchangeValue = parseFloat(lowExchange)
      const highExchangeValue = parseFloat(highExchange)

      if ([RValue, KValue, TValue, rValue, lowExchangeValue, highExchangeValue].some(isNaN)) {
        throw new Error("すべての入力フィールドに有効な数値を入力してください。")
      }

      const sigma = calculateVolatility(lowExchangeValue, highExchangeValue, RValue, TValue)
      setCalculatedSigma(sigma)

      const data: ChartDataPoint[] = []
      for (let strike = RValue * 0.5; strike <= RValue * 1.5; strike += RValue * 0.05) {
        const d1 = (Math.log(RValue / strike) + (rValue + sigma ** 2 / 2) * TValue) / (sigma * Math.sqrt(TValue))
        const d2 = d1 - sigma * Math.sqrt(TValue)

        const callPrice = RValue * normalCDF(d1) - strike * Math.exp(-rValue * TValue) * normalCDF(d2)
        const putPrice = strike * Math.exp(-rValue * TValue) * normalCDF(-d2) - RValue * normalCDF(-d1)

        data.push({
          strike: Number(strike.toFixed(2)),
          call: Number(callPrice.toFixed(2)),
          put: Number(putPrice.toFixed(2))
        })
      }
      setChartData(data)
      setShowChart(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "計算中にエラーが発生しました。")
      setShowChart(false)
    }
  }, [exchangeRate, K, T, r, lowExchange, highExchange, calculateVolatility, normalCDF])

  return (
    <TooltipProvider>
      <Card className="w-full max-w-4xl mx-auto my-8 p-6">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center mb-4">
            為替オプション価格計算機
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              <div>
                <Label htmlFor="baseCurrency">基軸通貨</Label>
                <Input 
                  id="baseCurrency" 
                  value={baseCurrency} 
                  onChange={(e) => setBaseCurrency(e.target.value)} 
                  placeholder="例：USD" 
                />
              </div>
              <div>
                <Label htmlFor="quoteCurrency">見積通貨</Label>
                <Input 
                  id="quoteCurrency" 
                  value={quoteCurrency} 
                  onChange={(e) => setQuoteCurrency(e.target.value)} 
                  placeholder="例：JPY" 
                />
              </div>
              <div>
                <Label htmlFor="exchangeRate">為替レート (R)</Label>
                <Input 
                  id="exchangeRate" 
                  type="text"
                  inputMode="decimal"
                  value={exchangeRate} 
                  onChange={(e) => handleNumberInput(e.target.value, setExchangeRate)} 
                  placeholder="例：110" 
                />
              </div>
              <div>
                <Label htmlFor="K">行使価格 (K)</Label>
                <Input 
                  id="K" 
                  type="text"
                  inputMode="decimal"
                  value={K} 
                  onChange={(e) => handleNumberInput(e.target.value, setK)} 
                  placeholder="例：110" 
                />
              </div>
              <div>
                <Label htmlFor="T">満期までの期間 (T) (年)</Label>
                <Input 
                  id="T" 
                  type="text"
                  inputMode="decimal"
                  value={T} 
                  onChange={(e) => handleNumberInput(e.target.value, setT)} 
                  placeholder="例：1" 
                />
              </div>
              <div>
                <Label htmlFor="r">無リスク金利 (r)</Label>
                <Input 
                  id="r" 
                  type="text"
                  inputMode="decimal"
                  value={r} 
                  onChange={(e) => handleNumberInput(e.target.value, setR)} 
                  placeholder="例：0.05" 
                />
              </div>
              <div>
                <Label htmlFor="lowExchange">予想最低為替レート</Label>
                <Input 
                  id="lowExchange" 
                  type="text"
                  inputMode="decimal"
                  value={lowExchange} 
                  onChange={(e) => handleNumberInput(e.target.value, setLowExchange)} 
                  placeholder="例：105" 
                />
              </div>
              <div>
                <Label htmlFor="highExchange">予想最高為替レート</Label>
                <Input 
                  id="highExchange" 
                  type="text"
                  inputMode="decimal"
                  value={highExchange} 
                  onChange={(e) => handleNumberInput(e.target.value, setHighExchange)} 
                  placeholder="例：115" 
                />
              </div>
            </div>

            <Button onClick={calculatePrices} className="w-full h-12 text-lg">
              <span className="mr-2">📊</span>計算して表示
            </Button>

            {error && (
              <div className="text-red-500 text-center font-semibold">
                {error}
              </div>
            )}

            {showChart && (
              <>
                <div className="h-[400px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="strike" 
                        label={{ value: '為替レート', position: 'insideBottom', offset: -5 }} 
                      />
                      <YAxis 
                        label={{ value: 'オプション価格', angle: -90, position: 'insideLeft' }} 
                      />
                      <RechartsTooltip 
                        formatter={(value) => `${value} ${quoteCurrency}`}
                        labelFormatter={(label) => `為替レート: ${label} ${quoteCurrency}/${baseCurrency}`}
                      />
                      <Legend verticalAlign="top" height={36}/>
                      <Line 
                        type="monotone" 
                        dataKey="call" 
                        stroke="#8884d8" 
                        name="コールオプション" 
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="put" 
                        stroke="#82ca9d" 
                        name="プットオプション" 
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div className="text-center mt-6">
                  <p className="text-lg font-semibold">
                    計算されたボラティリティ (σ): {calculatedSigma?.toFixed(4)}
                  </p>
                  <p className="mt-2">
                    現在の為替レート ({exchangeRate} {quoteCurrency}/{baseCurrency}) での理論価格:
                  </p>
                  <p className="mt-1">
                    <span className="font-semibold">コールオプション:</span> {chartData.find(d => d.strike === parseFloat(K))?.call.toFixed(2) || '-'} {quoteCurrency}
                  </p>
                  <p className="mt-1">
                    <span className="font-semibold">プットオプション:</span> {chartData.find(d => d.strike === parseFloat(K))?.put.toFixed(2) || '-'} {quoteCurrency}
                  </p>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  )
}