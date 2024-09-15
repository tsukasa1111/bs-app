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

export function EnhancedOptionPricer() {
  const [S, setS] = useState<string>('100')
  const [K, setK] = useState<string>('100')
  const [T, setT] = useState<string>('1')
  const [r, setR] = useState<string>('0.05')
  const [lowPrice, setLowPrice] = useState<string>('90')
  const [highPrice, setHighPrice] = useState<string>('110')
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
      throw new Error("価格と期間は正の値である必要があります。")
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
      const SValue = parseFloat(S)
      const KValue = parseFloat(K)
      const TValue = parseFloat(T)
      const rValue = parseFloat(r)
      const lowPriceValue = parseFloat(lowPrice)
      const highPriceValue = parseFloat(highPrice)

      if ([SValue, KValue, TValue, rValue, lowPriceValue, highPriceValue].some(isNaN)) {
        throw new Error("すべての入力フィールドに有効な数値を入力してください。")
      }

      const sigma = calculateVolatility(lowPriceValue, highPriceValue, SValue, TValue)
      setCalculatedSigma(sigma)

      const data: ChartDataPoint[] = []
      for (let strike = SValue * 0.5; strike <= SValue * 1.5; strike += SValue * 0.05) {
        const d1 = (Math.log(SValue / strike) + (rValue + sigma ** 2 / 2) * TValue) / (sigma * Math.sqrt(TValue))
        const d2 = d1 - sigma * Math.sqrt(TValue)

        const callPrice = SValue * normalCDF(d1) - strike * Math.exp(-rValue * TValue) * normalCDF(d2)
        const putPrice = strike * Math.exp(-rValue * TValue) * normalCDF(-d2) - SValue * normalCDF(-d1)

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
  }, [S, K, T, r, lowPrice, highPrice, calculateVolatility, normalCDF])

  return (
    <TooltipProvider>
      <Card className="w-full max-w-4xl mx-auto my-8 p-6">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center mb-4">
            高度なオプション価格計算機
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              <div>
                <Label htmlFor="S">
                  原資産価格 (S)
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="inline ml-1 w-4 h-4 text-gray-500 cursor-pointer" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>現在の株価を入力してください。</p>
                    </TooltipContent>
                  </Tooltip>
                </Label>
                <Input 
                  id="S" 
                  type="text"
                  inputMode="decimal"
                  value={S} 
                  onChange={(e) => handleNumberInput(e.target.value, setS)} 
                  placeholder="例：100" 
                />
              </div>
              <div>
                <Label htmlFor="K">
                  行使価格 (K)
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="inline ml-1 w-4 h-4 text-gray-500 cursor-pointer" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>オプションの行使価格を入力してください。</p>
                    </TooltipContent>
                  </Tooltip>
                </Label>
                <Input 
                  id="K" 
                  type="text"
                  inputMode="decimal"
                  value={K} 
                  onChange={(e) => handleNumberInput(e.target.value, setK)} 
                  placeholder="例：100" 
                />
              </div>
              <div>
                <Label htmlFor="T">
                  満期までの期間 (T) (年)
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="inline ml-1 w-4 h-4 text-gray-500 cursor-pointer" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>オプションの残存期間を年単位で入力してください。</p>
                    </TooltipContent>
                  </Tooltip>
                </Label>
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
                <Label htmlFor="r">
                  無リスク金利 (r)
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="inline ml-1 w-4 h-4 text-gray-500 cursor-pointer" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>現在の無リスク金利を小数で入力してください。</p>
                    </TooltipContent>
                  </Tooltip>
                </Label>
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
                <Label htmlFor="lowPrice">
                  予想最低価格
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="inline ml-1 w-4 h-4 text-gray-500 cursor-pointer" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>原資産の予想される最低価格を入力してください。</p>
                    </TooltipContent>
                  </Tooltip>
                </Label>
                <Input 
                  id="lowPrice" 
                  type="text"
                  inputMode="decimal"
                  value={lowPrice} 
                  onChange={(e) => handleNumberInput(e.target.value, setLowPrice)} 
                  placeholder="例：90" 
                />
              </div>
              <div>
                <Label htmlFor="highPrice">
                  予想最高価格
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="inline ml-1 w-4 h-4 text-gray-500 cursor-pointer" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>原資産の予想される最高価格を入力してください。</p>
                    </TooltipContent>
                  </Tooltip>
                </Label>
                <Input 
                  id="highPrice" 
                  type="text"
                  inputMode="decimal"
                  value={highPrice} 
                  onChange={(e) => handleNumberInput(e.target.value, setHighPrice)} 
                  placeholder="例：110" 
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
                        label={{ value: '行使価格', position: 'insideBottom', offset: -5 }} 
                      />
                      <YAxis 
                        label={{ value: 'オプション価格', angle: -90, position: 'insideLeft' }} 
                      />
                      <RechartsTooltip 
                        formatter={(value) => `${value} 円`}
                        labelFormatter={(label) => `行使価格: ${label} 円`}
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
                    現在の原資産価格 ({S}) での理論価格:
                  </p>
                  <p className="mt-1">
                    <span className="font-semibold">コールオプション:</span> {chartData.find(d => d.strike === parseFloat(K))?.call.toFixed(2) || '-'} 円
                  </p>
                  <p className="mt-1">
                    <span className="font-semibold">プットオプション:</span> {chartData.find(d => d.strike === parseFloat(K))?.put.toFixed(2) || '-'} 円
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