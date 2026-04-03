---
title: "ARC-AGI-3 Benchmark Shatters AGI Hype: Top Models Score Below 1%"
date: "2026-04-04"
excerpt: "The ARC-AGI-3 benchmark tested whether AI agents can generalize in unknown environments. Top models scored under 1% while humans solved 100%. The verdict: AGI is nowhere near here."
tags: ["AGI", "AI Benchmark", "ARC Prize", "OpenAI", "Anthropic", "Google"]
youtubeId: "dQw4w9WgXcQ"
source: "https://decrypt.co/362496/is-agi-here-not-even-close-ai-benchmark"
author: "SiliconFeed"
---

## The Reality Check

Jensen Huang said AGI is achieved. Sam Altman says OpenAI has "basically built AGI." Arm named a chip the "AGI CPU."

Then **ARC-AGI-3** dropped, and every frontier AI model scored below 1%.

Humans scored 100%.

## What ARC-AGI-3 Actually Tests

This isn't a trivia quiz or a coding exam. The benchmark, built by François Chollet's ARC Prize Foundation, drops AI agents into **135 original interactive game-like environments** with:

- Zero instructions
- Zero stated goals
- No rule descriptions

The agent has to explore, figure out what to do, form a plan, and execute it. Think of it as testing whether an AI can learn a brand-new game from scratch — the way any five-year-old can.

## The Scores Are Brutal

| Model | Score |
|---|---|
| Gemini 3.1 Pro | 0.37% |
| GPT-5.4 | 0.26% |
| Claude Opus 4.6 | 0.25% |
| Grok-4.20 | 0.00% |
| **Humans** | **100%** |

Scoring uses **RHAE** (Relative Human Action Efficiency). An AI that takes 10x more actions than a human scores 1%. The penalty squares inefficiency — wandering around and guessing gets punished hard.

## Why Previous Benchmarks Failed

ARC-AGI-1 fell to test-time training. ARC-AGI-2 lasted a year before Gemini hit 77.1%. The labs kept throwing compute at benchmarks until they saturated.

Version 3 prevents that. **110 of 135 environments are kept private.** There's no dataset to memorize. You can't brute-force novel game logic you've never seen.

## The One Caveat

A custom harness pushed Claude Opus 4.6 from 0.25% to 97.1% on a single environment variant. That doesn't change the overall score, but it suggests API-delivered JSON (the official test format) may disadvantage models better at visual or human-friendly inputs.

The foundation's response: perception isn't the bottleneck. Reasoning and generalization are.

## The Verdict

> "If a normal human with no instructions can do it, and your system can't, then you don't have AGI — you have a very expensive autocomplete that needs a lot of help."  
> — François Chollet, ARC Prize Foundation

The $2M ARC Prize 2026 competition is live on Kaggle. Every winning solution must be open-sourced. The clock is running, and the machines aren't close.

## Monster Take

The AGI hype machine is running at full throttle while the actual evidence points in the opposite direction. CEOs declare victory for marketing purposes. Benchmark designers build tests that expose the gap. ARC-AGI-3 isn't just a reality check — it's a challenge. The best AI agent in a month-long developer preview scored 12.58%. Frontier models cracked 1%. Humans solved everything on the first try with zero training. Until that gap closes, AGI is a marketing term, not a technical achievement.
