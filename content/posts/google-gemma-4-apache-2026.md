---
title: "Google Drops Gemma 4 Under Apache 2.0 вЂ” Now Runs on a Raspberry Pi"
date: "2026-04-02"
excerpt: "Google releases Gemma 4 вЂ” a family of AI models under Apache 2.0. 31B model, MoE architecture, edge models on 1.5GB RAM."
tags: ["Google", "Open Source", "LLM"]
youtubeId: "slH-jPY1TgE"
source: "https://techstartups.com/"
coverImage: "/covers/google-gemma-4-apache-2026.jpg"
author: "SiliconFeed"
---

## The Big Move

Let's be honest: when Google releases its models under Apache 2.0, it's not charity. It's a dominance play. Previous Gemma releases came with restrictive licenses. Apache 2.0 erases all barriers.

The family spans **four models**:

- **Gemma 4 31B** вЂ” dense model, ranked #3 on open leaderboards
- **Gemma 4 26B-A4B** вЂ” Google's first mixture-of-experts: 128 experts, only 3.8B active parameters
- **Gemma 4 E4B and E2B** вЂ” phones, Raspberry Pi, Jetson Nano. E2B runs under 1.5GB RAM

### Technical Specs

Context windows hit **256K** for large models, **128K** for edge. Native function-calling, structured JSON output, and system instructions are built-in. The models support **140+ languages** natively.

**NVIDIA** is already optimizing Gemma 4 for local RTX AI. **Ollama** added all four variants. You can run the 26B MoE locally in one command via llama.cpp.

### The Numbers

Gemma has now passed **400 million downloads** and 100,000+ community variants. The E2B and E4B are the foundation for Gemini Nano 4, shipping to Android devices later this year.

## Monster Take

The real story isn't "open source" вЂ” it's on-device AI. When a model runs 128K context on a $35 Raspberry Pi, everything changes. Edge computing just got its killer app.
