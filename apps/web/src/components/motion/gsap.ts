import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';

/**
 * Point d'entrée unique de GSAP : plugins enregistrés une fois. Depuis 2025,
 * ScrambleText, SplitText et ScrollTrigger sont gratuits et inclus dans gsap.
 */
gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText, ScrambleTextPlugin);
gsap.defaults({ ease: 'expo.out', duration: 1 });

export const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const HEX = '0123456789abcdef';

export { gsap, ScrollTrigger, SplitText, useGSAP };
