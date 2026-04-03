---
title: "Google Drops Gemma 4 Under Apache 2.0 — Now Runs on a Raspberry Pi"
date: "2026-04-02"
excerpt: "Google releases Gemma 4 — a family of AI models under Apache 2.0. 31B model, MoE architecture, edge models on 1.5GB RAM."
tags: ["Google", "Open Source", "LLM"]
coverImage: "https://img.youtube.com/vi/VHQanHNB_fg/sddefault.jpg"
youtubeId: "VHQanHNB_fg"
source: "https://techstartups.com/"
author: "SiliconFeed"
---

## The Big Move

Let's be honest: when Google releases its models under Apache 2.0, it's not charity. It's a dominance play. Previous Gemma releases came with restrictive custom licenses. Apache 2.0 erases all barriers — fork it, embed it, commercialize it.

The family spans four models:

- **Gemma 4 31B** — dense model, ranked #3 on open leaderboards
- **Gemma 4 26B-A4B** — Google's first mixture-of-experts: 128 experts, only 3.8B active parameters
- **Gemma 4 E4B and E2B** — run on phones, Raspberry Pi, and Jetson Nano. E2B under 1.5GB RAM

## Technical Specs That Matter

Context windows hit 256K for large models, 128K for edge. Native function-calling, structured JSON output, and system instructions are built-in. The models support 140+ languages natively.

**NVIDIA** is already optimizing Gemma 4 for local RTX AI. **Ollama** added all four variants. You can run the 26B MoE locally in one command via llama.cpp.

### The Download Numbers

Gemma has now passed **400 million downloads** and 100,000+ community fine-tunes. The E2B and E4B are the foundation for Gemini Nano 4, shipping to Android devices later this year.

## Monster Take

The real story isn't open source — it's on-device AI. When a model runs 128K context on a $35 Raspberry Pi, everything changes. Edge computing just got its killer app. Startups building local-first AI have never had it this good.
