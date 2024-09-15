'use client'

import React, { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StockOptionPricer } from './stock-option-pricer'
import { ForexOptionPricer } from './forex-option-pricer'

type PricerMode = 'stock' | 'forex'

export function EnhancedOptionPricer() {
  const [mode, setMode] = useState<PricerMode>('stock')

  return (
    <Card className="w-full max-w-4xl mx-auto my-8 p-6">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-center mb-4">
          高度なオプション価格計算機
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="flex justify-center space-x-4 mb-6">
            <Button 
              variant={mode === 'stock' ? 'default' : 'outline'} 
              onClick={() => setMode('stock')}
            >
              株式オプション
            </Button>
            <Button 
              variant={mode === 'forex' ? 'default' : 'outline'} 
              onClick={() => setMode('forex')}
            >
              為替オプション
            </Button>
          </div>

          {mode === 'stock' ? <StockOptionPricer /> : <ForexOptionPricer />}
        </div>
      </CardContent>
    </Card>
  )
}