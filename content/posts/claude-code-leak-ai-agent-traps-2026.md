---
title: "Claude Code's Source Leaked. The Web Is Now an Attack Surface."
date: "2026-04-04"
excerpt: "Anthropic's Claude Code source was leaked via npm. Google warns the open web is the #1 attack vector for AI agents. Prompt injections hit 86% success."
tags: ["Anthropic", "Claude Code", "AI Security", "Prompt Injection", "Developer Tools"]

source: "https://www.theneuron.ai/explainer-articles/-around-the-horn-digest-everything-that-happened-in-ai-today-wednesday-april-1-2026/"
coverImage: "/covers/claude-code-leak-ai-agent-traps-2026.jpg"
author: "SiliconFeed"
---

{{YOUTUBE:E28_B14wbEE}}

## The Leak That Exposed Everything

Anthropic accidentally shipped **Claude Code's full source code** via an npm source map. Developers immediately mapped the entire codebase:

- **1,893 files**, 517,000 lines of code
- **53+ tools**, 95+ slash commands
- Unreleased features: persistent memory, multi-agent worktrees, even a **Tamagotchi pet**

Anthropic issued copyright takedowns в— but the genie was out of the bottle.

> "Someone cracked Anthropic's signing system in under 24 hours."

## What the Code Revealed

Developer Lior Alexander reverse-engineered 14 production patterns from the leak:

- **Anti-abstraction coding rules** в— Claude Code refuses to create wrapper functions
- **Frustration regex analytics** в— tracking when users get confused
- **Tamagotchi buddy system** в— an internal pet for developer engagement
- **187 spinner verbs** в— the text shown while loading
- **Fake-tool anti-distillation** в— decoy tools to prevent cloning
- **42 Bash security checks** в— built-in shell safety

mem0 mapped the full memory architecture: flat markdown files, four types (user/feedback/project/reference), a 200-line `MEMORY.md` index with silent truncation, and a 25KB cap.

## The Open Web Is Now a Weapon

Google DeepMind published a paper introducing **"AI Agent Traps"** в— a taxonomy of six adversarial techniques showing the open web is now the primary attack surface for autonomous agents:

- Hidden HTML/CSS injections
- RAG memory poisoning
- Multi-agent manipulation
- **Prompt injections succeeding up to 86% of the time**

> "Autonomous agents browsing the web are walking into traps designed by bad actors."

## The Hacker Who Broke In

Paolo Anzn reverse-engineered Anthropic's compiled-Zig signing system in under 24 hours. The open-source hash generator is now merged, meaning **any third-party client** (OpenClaw, Claude Code forks, custom wrappers) can use paid Anthropic subscriptions without the official binary.

This isn't just a security win в— it's an ecosystem unlock.

## North Korea's Supply-Chain Strike

Reuters reported that **North Korea-linked hackers** compromised Axios, an open-source software component used across macOS, Windows, and Linux systems. The attackers inserted malicious code into a recent update, creating a supply-chain attack path that could expose credentials and data systemwide.

The malicious code has been removed в— but the incident shows how one obscure dependency can compromise thousands of apps.

> "The most damaging cyberattacks often start deep inside software nobody notices."

## The Workforce Parallel: Oracle Cuts 25K

While AI security escalates, the labor impact is accelerating too. Oracle laid off an estimated **20,000вЂ“30,000 employees** via 6am termination emails, freeing $8вЂ“10B in annual cash flow to fund AI data centers. Workers lost badge access before sunrise with zero warning.

Meanwhile, companies like **JustPaid** are deploying teams of seven AI agents (using OpenClaw + Claude Code) that shipped 10 major features in one month в— work that would have taken human developers months. Token costs: **$10KвЂ“15K/month**.

## Monster Take

The web is now hostile territory for AI agents. Prompt injections succeed 86% of the time. Nation-state hackers are weaponizing npm. And while Anthropic scrambles to contain a source leak, Oracle is firing 25K humans to pay for the compute running those same agents. Security, labor, and code are colliding в— and nobody is ready.
