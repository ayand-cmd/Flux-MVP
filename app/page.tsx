'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, BarChart3, ShieldCheck, Zap } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function LandingPage() {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);

  // --- NEW: Persistence Check ---
  useEffect(() => {
    const email = localStorage.getItem('userEmail');
    if (email) {
      router.push('/dashboard');
    } else {
      setIsChecking(false);
    }
  }, [router]);

  const handleLogin = () => {
    window.location.href = '/api/auth/google/login'; 
  };

  // Prevent flash of content while checking auth
  if (isChecking) return <div className="min-h-screen bg-[#0B0B15]" />;

  return (
    <div className="min-h-screen bg-[#0B0B15] text-white overflow-hidden relative selection:bg-indigo-500 selection:text-white font-sans">
      
      {/* Abstract Background Glows */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-indigo-600/20 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[100px]" />

      <nav className="relative z-10 max-w-7xl mx-auto px-6 h-24 flex items-center justify-between">
        <div className="flex items-center gap-2 font-bold text-xl tracking-tight">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Zap className="w-5 h-5 text-white" fill="currentColor" />
          </div>
          Flux.
        </div>
        <button 
          onClick={handleLogin}
          className="text-sm font-medium text-gray-300 hover:text-white transition-colors cursor-pointer"
        >
          Sign In
        </button>
      </nav>

      <main className="relative z-10 flex flex-col items-center justify-center pt-16 pb-32 px-4 text-center">
        
        <div className="inline-flex items-center px-3 py-1 rounded-full border border-white/10 bg-white/5 backdrop-blur-sm text-xs font-medium text-indigo-300 mb-8">
          <span className="w-2 h-2 bg-indigo-500 rounded-full mr-2 animate-pulse"></span>
          v2.0 Automated Sync is Live
        </div>

        <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 max-w-4xl mx-auto leading-tight">
          Stop guessing your <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-blue-400 to-cyan-400">
            Ad Spend.
          </span>
        </h1>

        <p className="text-lg text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          Flux unifies your Meta Ads data into Google Sheets automatically. 
          No more manual CSV exports. Just pure, real-time data flow.
        </p>

        <button 
          onClick={handleLogin}
          className="group relative inline-flex items-center gap-3 px-8 py-4 bg-white text-black font-bold rounded-full hover:bg-gray-100 transition-all hover:scale-105 active:scale-95 shadow-[0_0_40px_-10px_rgba(255,255,255,0.3)] cursor-pointer"
        >
          Start Syncing for Free
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </button>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-24 max-w-5xl mx-auto text-left">
          {[
            { icon: BarChart3, title: "Real-time Analytics", desc: "Data refreshes automatically. Decisions based on now, not yesterday." },
            { icon: ShieldCheck, title: "Secure by Design", desc: "We never store your ad creatives, only the performance metrics you need." },
            { icon: Zap, title: "1-Click Setup", desc: "Connect Meta, select your Sheet, and you're done. It's that simple." }
          ].map((feature, i) => (
            <div key={i} className="p-6 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm hover:border-white/20 transition-colors group">
              <div className="w-12 h-12 bg-white/5 rounded-lg flex items-center justify-center mb-4 group-hover:bg-indigo-500/20 transition-colors">
                <feature.icon className="w-6 h-6 text-indigo-400" />
              </div>
              <h3 className="font-semibold text-white mb-2">{feature.title}</h3>
              <p className="text-sm text-gray-400 leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>

      </main>
    </div>
  );
}