import React, { useState, useEffect, useRef } from "react";
import { GoogleGenAI, Modality } from "@google/genai";
import { MapPin, Languages, Volume2, Loader2, Navigation, Utensils, Info, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

// --- Types ---
interface Restaurant {
  id: string;
  name: string;
  image: string;
  specialty: string;
  distance: number;
  description: string;
}

interface Location {
  lat: number;
  lng: number;
}

const LANGUAGES = [
  { code: "en", name: "English", flag: "🇺🇸" },
  { code: "ko", name: "Korean", flag: "🇰🇷" },
  { code: "ja", name: "Japanese", flag: "🇯🇵" },
  { code: "vi", name: "Vietnamese", flag: "🇻🇳" },
];

export default function App() {
  // --- State ---
  const [location, setLocation] = useState<Location | null>(null);
  const [language, setLanguage] = useState("en");
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [guideText, setGuideText] = useState("");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // --- Audio Playback (Web Audio API) ---
  const stopAudio = () => {
    if (audioSourceRef.current) {
      try {
        audioSourceRef.current.stop();
      } catch (e) {
        // Ignore if already stopped
      }
      audioSourceRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setAudioUrl(null);
  };

  const playRawPCM = async (base64Data: string) => {
    try {
      stopAudio(); // Stop any previous audio
      
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      audioContextRef.current = audioContext;
      
      // Chuyển Base64 sang ArrayBuffer
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      // Giả định dữ liệu là 16-bit PCM (L16)
      const int16Array = new Int16Array(bytes.buffer);
      const float32Array = new Float32Array(int16Array.length);
      
      // Chuẩn hóa về khoảng [-1.0, 1.0]
      for (let i = 0; i < int16Array.length; i++) {
        float32Array[i] = int16Array[i] / 32768;
      }
      
      const audioBuffer = audioContext.createBuffer(1, float32Array.length, 24000);
      audioBuffer.getChannelData(0).set(float32Array);
      
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      source.onended = () => {
        setAudioUrl(null);
      };
      
      audioSourceRef.current = source;
      source.start();
    } catch (err) {
      console.error("Web Audio API Error:", err);
    }
  };

  // --- Geolocation ---
  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newLoc = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setLocation(newLoc);
          fetchNearby(newLoc);
        },
        (err) => {
          setError("Location access denied. Please enable GPS to find nearby food.");
          // Fallback to Vinh Khanh street center for demo
          const fallbackLoc = { lat: 10.7612, lng: 106.7055 };
          setLocation(fallbackLoc);
          fetchNearby(fallbackLoc);
        }
      );
    } else {
      setError("Geolocation is not supported by your browser.");
    }
  }, []);

  const fetchNearby = async (loc: Location) => {
    setLoading(true);
    try {
      const response = await fetch("/api/nearby", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(loc),
      });
      const data = await response.json();
      setRestaurants(data);
    } catch (err) {
      setError("Failed to fetch nearby restaurants.");
    } finally {
      setLoading(false);
    }
  };

  // --- AI Integration ---
  const generateAudioGuide = async (restaurant: Restaurant) => {
    if (isGenerating) return;
    
    setIsGenerating(true);
    setGuideText("");
    setAudioUrl(null);
    setSelectedRestaurant(restaurant);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      
      // 1. Generate Text Script
      const textModel = ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Act as a friendly, enthusiastic local tour guide at Vinh Khanh street in Ho Chi Minh City. 
        Generate a short, engaging 2-sentence guide for the restaurant "${restaurant.name}". 
        Mention their specialty: "${restaurant.specialty}". 
        The language must be: ${LANGUAGES.find(l => l.code === language)?.name}.`,
      });

      const textResponse = await textModel;
      const script = textResponse.text || "";
      setGuideText(script);

      // 2. Generate Audio (TTS)
      const ttsResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `Speak cheerfully in ${LANGUAGES.find(l => l.code === language)?.name}: ${script}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
          },
        },
      });

      const audioPart = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData;
      if (audioPart?.data) {
        await playRawPCM(audioPart.data);
        setAudioUrl("playing"); // Đánh dấu là đang phát để hiển thị UI
      }
    } catch (err) {
      console.error("AI Error:", err);
      setError("Failed to generate audio guide. Please check your API key.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 font-sans">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-stone-200 px-4 py-4">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-emerald-600 p-2 rounded-lg text-white">
              <Utensils size={20} />
            </div>
            <h1 className="font-bold text-lg tracking-tight">Vinh Khanh Guide</h1>
          </div>
          
          <div className="flex items-center gap-2 bg-stone-100 p-1 rounded-full">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                onClick={() => setLanguage(lang.code)}
                className={`w-8 h-8 flex items-center justify-center rounded-full transition-all ${
                  language === lang.code ? "bg-white shadow-sm scale-110" : "opacity-50 grayscale hover:opacity-100"
                }`}
                title={lang.name}
              >
                {lang.flag}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-6 pb-32">
        {/* Status Section */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-stone-500 text-sm mb-1">
            <MapPin size={14} />
            <span>Current Location</span>
          </div>
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">
              {location ? "Vinh Khanh Food Street" : "Locating..."}
            </h2>
            {loading && <Loader2 className="animate-spin text-emerald-600" size={20} />}
          </div>
          {error && (
            <div className="mt-3 p-3 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100">
              {error}
            </div>
          )}
        </div>

        {/* Restaurant List */}
        <div className="space-y-6">
          <AnimatePresence mode="popLayout">
            {restaurants.map((rest) => (
              <motion.div
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                key={rest.id}
                onClick={() => generateAudioGuide(rest)}
                className={`group relative overflow-hidden bg-white rounded-3xl border transition-all cursor-pointer ${
                  selectedRestaurant?.id === rest.id 
                    ? "border-emerald-500 ring-2 ring-emerald-500/20" 
                    : "border-stone-200 hover:border-stone-300 shadow-sm"
                }`}
              >
                <div className="aspect-[16/9] overflow-hidden">
                  <img 
                    src={rest.image || undefined} 
                    alt={rest.name}
                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute top-3 right-3 bg-white/90 backdrop-blur px-3 py-1 rounded-full text-xs font-bold shadow-sm flex items-center gap-1">
                    <Navigation size={10} className="text-emerald-600" />
                    {rest.distance}m
                  </div>
                </div>
                
                <div className="p-5">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-lg font-bold">{rest.name}</h3>
                    <div className="text-emerald-600">
                      <Volume2 size={20} />
                    </div>
                  </div>
                  <p className="text-stone-500 text-sm mb-3 line-clamp-2">
                    {rest.description}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-wider font-bold text-stone-400">Specialty</span>
                    <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded text-xs font-medium">
                      {rest.specialty}
                    </span>
                  </div>
                </div>

                {isGenerating && selectedRestaurant?.id === rest.id && (
                  <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] flex flex-col items-center justify-center">
                    <Loader2 className="animate-spin text-emerald-600 mb-2" size={32} />
                    <span className="text-xs font-bold text-emerald-800 uppercase tracking-widest">Generating Guide...</span>
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </main>

      {/* Audio Player Overlay */}
      <AnimatePresence>
        {selectedRestaurant && guideText && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-6 left-4 right-4 z-50"
          >
            <div className="max-w-md mx-auto bg-stone-900 text-white p-5 rounded-3xl shadow-2xl border border-white/10">
              <div className="flex items-center gap-4 mb-3">
                <div className="w-12 h-12 rounded-2xl overflow-hidden flex-shrink-0">
                  <img 
                    src={selectedRestaurant.image || undefined} 
                    className="w-full h-full object-cover" 
                    referrerPolicy="no-referrer" 
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold truncate">{selectedRestaurant.name}</h4>
                  <p className="text-stone-400 text-xs truncate">Audio Guide • {LANGUAGES.find(l => l.code === language)?.name}</p>
                </div>
                <button 
                  onClick={() => {
                    stopAudio();
                    setSelectedRestaurant(null);
                  }}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              
              <div className="bg-white/5 rounded-2xl p-4 mb-4">
                <p className="text-sm italic leading-relaxed text-stone-200">
                  "{guideText}"
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: audioUrl === "playing" ? "100%" : "0%" }}
                    transition={{ duration: 5, ease: "linear" }}
                    className="h-full bg-emerald-500"
                  />
                </div>
                <Volume2 size={16} className="text-emerald-500 animate-pulse" />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Background Decoration */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[50%] aspect-square bg-emerald-100/50 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[50%] aspect-square bg-stone-200/50 blur-[120px] rounded-full" />
      </div>
    </div>
  );
}
