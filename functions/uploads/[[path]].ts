/**
 * Cloudflare Pages Function: /uploads/*
 * Serves uploaded images directly from Cloudflare R2 and persistent Firestore fallback
 */
export { onRequestGet, onRequestHead, onRequestOptions, onRequest } from "../api/images/[[path]]";
