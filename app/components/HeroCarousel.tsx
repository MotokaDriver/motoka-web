"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import app1 from "../../public/images/app_1.webp";
import app2 from "../../public/images/app2.webp";
import app3 from "../../public/images/app3.webp";
import app4 from "../../public/images/app4.webp";

const images = [app1, app2, app3, app4];

export default function HeroCarousel() {
    const [activeIndex, setActiveIndex] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setActiveIndex((prev) => (prev + 1) % images.length);
        }, 3500);

        return () => clearInterval(interval);
    }, []);

    const getStyles = (index: number) => {
        // Calculate difference handling the wrap-around
        let diff = (index - activeIndex) % images.length;
        if (diff < 0) diff += images.length;

        // We want to show: Center (0), Right (1), Left (Last)
        // For 4 images: 0 is center, 1 is right, 2 is hidden/back, 3 is left

        if (diff === 0) {
            return "z-30 scale-100 opacity-100 translate-x-0 translate-z-0 rotate-y-0 shadow-2xl";
        } else if (diff === 1) {
            return "z-20 scale-85 opacity-60 translate-x-[60%] -translate-z-10 -rotate-y-12 blur-[1px]";
        } else if (diff === images.length - 1) {
            return "z-20 scale-85 opacity-60 -translate-x-[60%] -translate-z-10 rotate-y-12 blur-[1px]";
        } else {
            return "z-10 scale-75 opacity-0 translate-x-0 -translate-z-20";
        }
    };

    return (
        <div className="relative w-full max-w-[600px] h-[600px] flex items-center justify-center perspective-[1200px] overflow-visible mx-auto">
            {/* Background Glow */}
            <div className="absolute inset-0 bg-gradient-to-b from-blue-500/10 to-purple-500/10 rounded-full blur-3xl -z-10 transform scale-150"></div>

            {images.map((img, index) => (
                <div
                    key={index}
                    className={`absolute transition-all duration-700 ease-out will-change-transform ${getStyles(index)}`}
                    style={{
                        transformStyle: 'preserve-3d',
                        width: '300px',
                        height: '600px',
                    }}
                >
                    {/* Phone Frame */}
                    <div className="relative w-full h-full bg-gray-900 rounded-[3rem] shadow-2xl border-[8px] border-gray-800 overflow-hidden ring-1 ring-white/20">
                        {/* Notch/Dynamic Island */}
                        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 w-[30%] h-7 bg-black rounded-full z-20 flex items-center justify-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-gray-800/50"></div>
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-900/20"></div>
                        </div>

                        {/* Screen */}
                        <div className="relative w-full h-full bg-black">
                            <Image
                                src={img}
                                alt={`App Screen ${index + 1}`}
                                fill
                                className="object-contain" // Changed from object-cover to prevent cropping
                                priority={index === 0}
                            />

                            {/* Home Bar Indicator */}
                            <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 w-1/3 h-1 bg-white/20 rounded-full z-20"></div>

                            {/* Screen Glare/Reflection */}
                            <div className="absolute inset-0 bg-gradient-to-tr from-white/5 via-transparent to-transparent pointer-events-none z-10"></div>
                        </div>
                    </div>

                    {/* Shadow below phone */}
                    <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 w-3/4 h-4 bg-black/40 blur-xl rounded-full"></div>
                </div>
            ))}
        </div>
    );
}
