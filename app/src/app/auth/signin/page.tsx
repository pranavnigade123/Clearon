/**
 * Sign In Page - Modern Design
 * Beautiful authentication with enhanced UX
 */

'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Brain, Mail, Eye, EyeOff, ArrowRight, Sparkles, Github } from 'lucide-react';

export default function SignInPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';
  const error = searchParams.get('error');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  const handleCredentialsSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setAuthError('');

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setAuthError('Invalid email or password');
      } else {
        router.push(callbackUrl);
      }
    } catch (error) {
      setAuthError('An error occurred during sign in');
    } finally {
      setIsLoading(false);
    }
  };

  const handleProviderSignIn = async (provider: string) => {
    setIsLoading(true);
    try {
      await signIn(provider, { callbackUrl });
    } catch (error) {
      setAuthError('An error occurred during sign in');
      setIsLoading(false);
    }
  };

  const getErrorMessage = (error: string) => {
    switch (error) {
      case 'CredentialsSignin':
        return 'Invalid email or password';
      case 'OAuthSignin':
      case 'OAuthCallback':
      case 'OAuthCreateAccount':
      case 'EmailCreateAccount':
        return 'Error with OAuth provider';
      case 'Callback':
        return 'Error in callback';
      case 'OAuthAccountNotLinked':
        return 'Account already exists with different provider';
      case 'EmailSignin':
        return 'Error sending email';
      case 'SessionRequired':
        return 'Please sign in to access this page';
      default:
        return 'An error occurred during sign in';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 flex items-center justify-center px-4">
      {/* Background Elements */}
      <div className="absolute inset-0 overflow-hidden -z-10">
        <div className="absolute top-20 left-10 w-72 h-72 bg-blue-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob"></div>
        <div className="absolute top-40 right-10 w-72 h-72 bg-purple-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-20 left-20 w-72 h-72 bg-pink-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob animation-delay-4000"></div>
      </div>

      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl mb-4">
            <Brain className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
            Welcome Back
          </h1>
          <p className="text-slate-600">
            Sign in to access your AI knowledge platform
          </p>
        </div>

        {/* Sign In Card */}
        <Card className="border-0 shadow-2xl bg-white/80 backdrop-blur-sm">
          <CardContent className="p-8">
            {(error || authError) && (
              <Alert variant="destructive" className="mb-6 border-red-200 bg-red-50">
                <AlertDescription className="text-red-700">
                  {error ? getErrorMessage(error) : authError}
                </AlertDescription>
              </Alert>
            )}

            {/* OAuth Providers */}
            <div className="space-y-3 mb-6">
              <Button
                variant="outline"
                className="w-full h-12 border-slate-300 hover:border-blue-400 hover:bg-blue-50 transition-all duration-300"
                onClick={() => handleProviderSignIn('google')}
                disabled={isLoading}
              >
                <Mail className="w-5 h-5 mr-3 text-red-500" />
                <span className="font-medium">Continue with Google</span>
              </Button>
              
              <Button
                variant="outline"
                className="w-full h-12 border-slate-300 hover:border-slate-400 hover:bg-slate-50 transition-all duration-300"
                onClick={() => handleProviderSignIn('github')}
                disabled={isLoading}
              >
                <Github className="w-5 h-5 mr-3" />
                <span className="font-medium">Continue with GitHub</span>
              </Button>
            </div>

            {/* Divider */}
            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white text-slate-500 font-medium">
                  Or sign in with email
                </span>
              </div>
            </div>

            {/* Email/Password Form */}
            <form onSubmit={handleCredentialsSignIn} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-2">
                  Email Address
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                  className="h-12 border-slate-300 focus:border-blue-400 focus:ring-blue-400"
                />
              </div>
              
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-2">
                  Password
                </label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    className="h-12 pr-12 border-slate-300 focus:border-blue-400 focus:ring-blue-400"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>
              
              <Button
                type="submit"
                className="w-full h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium shadow-lg transition-all duration-300"
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="flex items-center">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    Signing in...
                  </div>
                ) : (
                  <div className="flex items-center">
                    Sign In
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </div>
                )}
              </Button>
            </form>

            {/* Sign Up Link */}
            <div className="text-center mt-6 pt-6 border-t border-slate-200">
              <p className="text-slate-600">
                Don't have an account?{' '}
                <Link
                  href="/auth/signup"
                  className="font-medium text-blue-600 hover:text-blue-700 transition-colors"
                >
                  Create one now
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-sm text-slate-500">
            Secure authentication powered by NextAuth.js
          </p>
        </div>
      </div>
    </div>
  );
}