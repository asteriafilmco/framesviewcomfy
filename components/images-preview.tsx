/* eslint-disable @next/next/no-img-element */
"use client";
import { cn, getFullImagePath } from "@/lib/utils";
import React, { useState } from "react";
import { motion } from "framer-motion";
import type { IViewComfyWorkflow } from "@/app/providers/view-comfy-provider";

export function PreviewOutputsImageGallery({
    viewComfyJSON
}: {
    viewComfyJSON: IViewComfyWorkflow
}) {
    const rawImage1 = viewComfyJSON.previewImages && viewComfyJSON.previewImages[0] ? viewComfyJSON.previewImages[0] : null;
    const rawImage2 = viewComfyJSON.previewImages && viewComfyJSON.previewImages[1] ? viewComfyJSON.previewImages[1] : null;
    const rawImage3 = viewComfyJSON.previewImages && viewComfyJSON.previewImages[2] ? viewComfyJSON.previewImages[2] : null;

    const [image1, setImage1] = useState<string | null>(getFullImagePath(rawImage1));
    const [image2, setImage2] = useState<string | null>(getFullImagePath(rawImage2));
    const [image3, setImage3] = useState<string | null>(getFullImagePath(rawImage3));

    const first = {
        initial: {
            x: 20,
            rotate: -5,
        },
        hover: {
            x: 0,
            rotate: 0,
        },
    };
    const second = {
        initial: {
            x: -20,
            rotate: 5,
        },
        hover: {
            x: 0,
            rotate: 0,
        },
    };
    return (
        <>
            <motion.div
                initial="initial"
                animate="animate"
                whileHover="hover"
                className="flex w-full min-h-[6rem] dark:bg-dot-white/[0.2] bg-dot-black/[0.2] flex-row space-x-2 items-center justify-center p-4"
            >   
                {(image1) && (
                    <motion.div
                        variants={first}
                        className="flex items-center justify-center overflow-hidden"
                    >
                        <img
                            src={image1}
                            alt="avatar"
                            className={cn("w-full h-auto object-contain transition-all hover:scale-105")}
                            onError={() => {
                                setImage1(null);
                            }}
                        />
                    </motion.div>
                )}
                {(image2) && (
                    <motion.div
                        className="relative z-20 flex items-center justify-center overflow-hidden"
                    >
                        <img
                            src={image2}
                            alt="avatar"
                            className={cn("w-full h-auto object-contain transition-all hover:scale-105")}
                            onError={() => {
                                setImage2(null);
                            }}
                        />
                    </motion.div>
                )}
                {(image3) && (
                    <motion.div
                        variants={second}
                        className="flex items-center justify-center overflow-hidden"
                    >
                        <img
                            src={image3}
                            alt="avatar"
                            className={cn("w-full h-auto object-contain transition-all hover:scale-105")}
                            onError={() => {
                                setImage3(null);
                            }}
                        />
                    </motion.div>
                )}
            </motion.div>
        {!(image1 ?? image2 ?? image3) && (
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full text-center">
                <span className="text-lg">
                    Click the Generate button to start.
                </span>
            </div>
        )}
        </>
    );
};
