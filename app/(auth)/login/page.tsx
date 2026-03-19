"use client"

import { signIn } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function LoginPage() {
  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Welcome to FlowMeet</CardTitle>
        <CardDescription>
          Sign in to automatically generate specs from your meetings
        </CardDescription>
      </CardHeader>
      <CardContent className="flex justify-center">
        <Button 
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
