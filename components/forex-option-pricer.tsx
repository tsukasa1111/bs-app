'use client'

import React, { useState, useCallback } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { TooltipProvider } from "@/components/ui/tooltip"
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer 
} from 'recharts'

type ChartDataPoint = {
  strike: number;
  call: number;
  put: number;
}

type PricingModel = 'blackScholes' | 'monteCarlo' | 'binomial' | 'heston'

export function ForexOptionPricer() {
  const [baseCurrency, setBaseCurrency] = useState<string>('USD')
  const [quoteCurrency, setQuoteCurrency] = useState<string>('JPY')
  const [exchangeRate, setExchangeRate] = useState<string>('110')
  const [K, setK] = useState<string>('110')
  const [T, setT] = useState<string>('1')
  const [r, setR] = useState<string>('0.05')
  const [lowExchange, setLowExchange] = useState<string>('105')
  const [highExchange, setHighExchange] = useState<string>('115')
  const [v0, setV0] = useState<string>('0.04')
  const [kappa, setKappa] = useState<string>('2')
  const [theta, setTheta] = useState<string>('0.04')
  const [xi, setXi] = useState<string>('0.3')
  const [rho, setRho] = useState<string>('-0.7')
  const [chartData, setChartData] = useState<ChartDataPoint[]>([])
  const [showChart, setShowChart] = useState<boolean>(false)
  const [calculatedSigma, setCalculatedSigma] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [model, setModel] = useState<PricingModel>('blackScholes')
  const [isCalculating, setIsCalculating] = useState<boolean>(false)

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

  const calculateVolatility = useCallback((low: number, high: number, R: number, T: number): number => {
    if (low <= 0 || high <= 0 || R <= 0 || T <= 0) {
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

  const calculateBlackScholes = useCallback((R: number, K: number, T: number, r: number, sigma: number) => {
    const d1 = (Math.log(R / K) + (r + 0.5 * sigma ** 2) * T) / (sigma * Math.sqrt(T))
    const d2 = d1 - sigma * Math.sqrt(T)

    const callPrice = R * normalCDF(d1) - K * Math.exp(-r * T) * normalCDF(d2)
    const putPrice = K * Math.exp(-r * T) * normalCDF(-d2) - R * normalCDF(-d1)

    return { callPrice, putPrice }
  }, [normalCDF])

  const calculateMonteCarlo = useCallback((R: number, K: number, T: number, r: number, sigma: number, simulations: number = 10000) => {
    let callSum = 0
    let putSum = 0
    for (let i = 0; i < simulations; i++) {
      const Z = inverseNormalCDF()
      const RT = R * Math.exp((r - 0.5 * sigma ** 2) * T + sigma * Math.sqrt(T) * Z)
      const call = Math.max(RT - K, 0)
      const put = Math.max(K - RT, 0)
      callSum += call
      putSum += put
    }
    const callPrice = Math.exp(-r * T) * (callSum / simulations)
    const putPrice = Math.exp(-r * T) * (putSum / simulations)
    return { callPrice, putPrice }
  }, [])

  const calculateBinomial = useCallback((R: number, K: number, T: number, r: number, sigma: number, steps: number = 100) => {
    const dt = T / steps
    const u = Math.exp(sigma * Math.sqrt(dt))
    const d = 1 / u
    const p = (Math.exp(r * dt) - d) / (u - d)

    const assetPrices: number[] = []
    for (let i = 0; i <= steps; i++) {
      assetPrices.push(R * Math.pow(u, steps - i) * Math.pow(d, i))
    }

    const callValues: number[] = assetPrices.map(price => Math.max(price - K, 0))
    const putValues: number[] = assetPrices.map(price => Math.max(K - price, 0))

    for (let step = steps - 1; step >= 0; step--) {
      for (let i = 0; i <= step; i++) {
        callValues[i] = Math.exp(-r * dt) * (p * callValues[i] + (1 - p) * callValues[i + 1])
        putValues[i] = Math.exp(-r * dt) * (p * putValues[i] + (1 - p) * putValues[i + 1])
      }
    }

    return { callPrice: callValues[0], putPrice: putValues[0] }
  }, [])

  const calculateHeston = useCallback((R: number, K: number, T: number, r: number, v0: number, kappa: number, theta: number, xi: number, rho: number, steps: number = 100) => {
    const dt = T / steps
    let R_t = R
    let v_t = v0
    let callSum = 0
    let putSum = 0
    const simulations = 10000

    for (let sim = 0; sim < simulations; sim++) {
      R_t = R
      v_t = v0
      for (let t = 0; t < steps; t++) {
        const Z_R = inverseNormalCDF()
        const Z_v = rho * Z_R + Math.sqrt(1 - rho * rho) * inverseNormalCDF()
        
        R_t = R_t * Math.exp((r - 0.5 * v_t) * dt + Math.sqrt(v_t * dt) * Z_R)
        v_t = Math.max(v_t + kappa * (theta - v_t) * dt + xi * Math.sqrt(v_t * dt) * Z_v, 0)
      }
      callSum += Math.max(R_t - K, 0)
      putSum += Math.max(K - R_t, 0)
    }

    const callPrice = Math.exp(-r * T) * (callSum / simulations)
    const putPrice = Math.exp(-r * T) * (putSum / simulations)
    return { callPrice, putPrice }
  }, [])

  const inverseNormalCDF = (): number => {
    const u1 = Math.random()
    const u2 = Math.random()
    const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2)
    return z0
  }

  const calculatePrices = useCallback(() => {
    setIsCalculating(true)
    setError(null)
    setShowChart(false)

    setTimeout(() => {
      try {
        const RValue = parseFloat(exchangeRate)
        const KValue = parseFloat(K)
        const TValue = parseFloat(T)
        const rValue = parseFloat(r)
        const lowExchangeValue = parseFloat(lowExchange)
        const highExchangeValue = parseFloat(highExchange)
        const v0Value = parseFloat(v0)
        const kappaValue = parseFloat(kappa)
        const thetaValue = parseFloat(theta)
        const xiValue = parseFloat(xi)
        const rhoValue = parseFloat(rho)

        if ([RValue, KValue, TValue, rValue, lowExchangeValue, highExchangeValue, v0Value, kappaValue, thetaValue, xiValue, rhoValue].some(isNaN)) {
          throw new Error("すべての入力フィールドに有効な数値を入力してください。")
        }

        const sigma = calculateVolatility(lowExchangeValue, highExchangeValue, RValue, TValue)
        setCalculatedSigma(sigma)

        const data: ChartDataPoint[] = []
        for (let strike = RValue * 0.5; strike <= RValue * 1.5; strike += RValue * 0.05) {
          let prices
          switch (model) {
            case 'blackScholes':
              prices = calculateBlackScholes(RValue, strike, TValue, rValue, sigma)
              break
            case 'monteCarlo':
              prices = calculateMonteCarlo(RValue, strike, TValue, rValue, sigma)
              break
            case 'binomial':
              prices = calculateBinomial(RValue, strike, TValue, rValue, sigma)
              break
            case 'heston':
              prices = calculateHeston(RValue, strike, TValue, rValue, v0Value, kappaValue, thetaValue, xiValue, rhoValue)
              break
            default:
              throw new Error("無効なモデルが選択されました。")
          }

          data.push({
            strike: Number(strike.toFixed(2)),
            call: Number(prices.callPrice.toFixed(2)),
            put: Number(prices.putPrice.toFixed(2))
          })
        }
        setChartData(data)
        setShowChart(true)
      } catch (err) {
        setError(err instanceof Error ? err.message : "計算中にエラーが発生しました。")
      } finally {
        setIsCalculating(false)
      }
    }, 100)  // 計算処理を少し遅延させて、UIの更新を確実にします
  }, [exchangeRate, K, T, r, lowExchange, highExchange, v0, kappa, theta, xi, rho, calculateVolatility, calculateBlackScholes, calculateMonteCarlo, calculateBinomial, calculateHeston, model])

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
            <div className="flex justify-center space-x-2">
              <Button 
                variant={model === 'blackScholes' ? 'default' : 'outline'} 
                onClick={() => setModel('blackScholes')}
              >
                ブラックショールズ
              </Button>
              <Button 
                variant={model === 'monteCarlo' ? 'default' : 'outline'} 
                onClick={() => setModel('monteCarlo')}
              >
                モンテカルロ
              </Button>
              <Button 
                variant={model === 'binomial' ? 'default' : 'outline'} 
                onClick={() => setModel('binomial')}
              >
                バイノミアル
              </Button>
              <Button 
                variant={model === 'heston' ? 'default' : 'outline'} 
                onClick={() => setModel('heston')}
              >
                ヘストン
              </Button>
            </div>

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
              {model === 'heston' && (
                <>
                  <div>
                    <Label htmlFor="v0">初期ボラティリティ (v0)</Label>
                    <Input 
                      id="v0" 
                      type="text"
                      inputMode="decimal"
                      value={v0} 
                      onChange={(e) => handleNumberInput(e.target.value, setV0)} 
                      placeholder="例：0.04" 
                    />
                  </div>
                  <div>
                    <Label htmlFor="kappa">平均回帰速度 (κ)</Label>
                    <Input 
                      id="kappa" 
                      type="text"
                      inputMode="decimal"
                      value={kappa} 
                      onChange={(e) => handleNumberInput(e.target.value, setKappa)} 
                      placeholder="例：2" 
                    />
                  </div>
                  <div>
                    <Label htmlFor="theta">長期ボラティリティ (θ)</Label>
                    <Input 
                      id="theta" 
                      type="text"
                      inputMode="decimal"
                      value={theta} 
                      onChange={(e) => handleNumberInput(e.target.value, setTheta)} 
                      placeholder="例：0.04" 
                    />
                  </div>
                  <div>
                    <Label htmlFor="xi">ボラティリティのボラティリティ (ξ)</Label>
                    <Input 
                      id="xi" 
                      type="text"
                      inputMode="decimal"
                      value={xi} 
                      onChange={(e) => handleNumberInput(e.target.value, setXi)} 
                      placeholder="例：0.3" 
                    />
                  </div>
                  <div>
                    <Label htmlFor="rho">相関係数 (ρ)</Label>
                    <Input 
                      id="rho" 
                      type="text"
                      inputMode="decimal"
                      value={rho} 
                      onChange={(e) => handleNumberInput(e.target.value, setRho)} 
                      placeholder="例：-0.7" 
                    />
                  </div>
                </>
              )}
            </div>

            <Button onClick={calculatePrices} className="w-full h-12 text-lg" disabled={isCalculating}>
              {isCalculating ? (
                <>
                  <span className="mr-2">🔄</span>計算中...
                </>
              ) : (
                <>
                  <span className="mr-2">📊</span>計算して表示
                </>
              )}
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