"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState("demo@flowmeet.ai")
  const [name, setName] = useState("Demo User")

  const handleGuestLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    await signIn("guest-login", {
      email,
      name,
      callbackUrl: "/",
    })
    setLoading(false)
  }

  return (
    <Card className="w-full max-w-md shadow-md border">
      <CardHeader className="text-center space-y-1">
        <CardTitle className="text-2xl font-bold tracking-tight">Welcome to FlowMeet</CardTitle>
        <CardDescription>
          Client workspace & free AI meeting spec generator
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleGuestLogin} className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500 uppercase">Your Name</label>
            <Input 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              placeholder="e.g. Priyesh Singh" 
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500 uppercase">Email</label>
            <Input 
              type="email"
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              placeholder="you@company.com" 
              required
            />
          </div>
          <Button 
            type="submit" 
            className="w-full bg-blue-600 hover:bg-blue-700 text-white" 
            size="lg"
            disabled={loading}
          >
            {loading ? "Entering..." : "Instant Access (Free Demo)"}
          </Button>
        </form>

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-2 text-gray-400">Or</span>
          </div>
        </div>

        <Button 
          variant="outline"
          onClick={() => signIn("google", { callbackUrl: "/" })}
          className="w-full"
          size="lg"
        >
          Sign in with Google
        </Button>
      </CardContent>
    </Card>
  )
}
