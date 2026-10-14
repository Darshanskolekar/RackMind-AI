# Contributing to RackMind AI (TwinOps)

Thank you for your interest in contributing to **RackMind AI (TwinOps)**! We welcome contributions from data center architects, infrastructure engineers, SREs, and AI developers.

---

## 1. Code of Conduct
We are committed to providing a welcoming, inclusive, and professional environment. All participants are expected to uphold respectful, harassment-free collaboration.

---

## 2. Development Setup

### Prerequisites
- Node.js `18.x` or `20.x` LTS
- npm or bun
- A valid Google AI Studio Gemini API key

### Initializing the Project
```bash
# Clone the repository
git clone https://github.com/your-org/rackmind-ai.git
cd rackmind-ai

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Start dev server (Express backend + Vite HMR)
npm run dev
```

The application runs on `http://localhost:3000`.

---

## 3. Telemetry Schema & Code Standards

### Strict Typing
- All hardware, electrical, and cooling telemetry must adhere to the TypeScript interfaces defined in `src/types/telemetry.ts` and `src/data/rackBaseline.ts`.
- Ensure new hardware models provide explicit:
  - `slot_u` (starting 1-indexed U position)
  - `height_u` (chassis height in rack units)
  - `power_draw_w` (nominal power draw in Watts)
  - Thermal sensors (`inlet_temp_c`, `outlet_temp_c`, `gpu_subsystem_peak_temp_c`)

### Styling & UI Guidelines
- Use **Tailwind CSS** utilities with semantic dark-mode palette (`slate-900`, `slate-950`, `cyan-400`, `emerald-400`, `amber-400`, `rose-500`).
- Ensure high-contrast visual indicators for critical thermal states (e.g. animated pulse rings on servers exceeding 75°C).

---

## 4. Verification Workflow

Before submitting a Pull Request, run all verification checks locally:

```bash
# 1. Verify TypeScript types and lint
npm run lint

# 2. Verify production bundle compilation
npm run build
```

---

## 5. Submitting Pull Requests
1. Create a feature branch from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```
2. Commit your changes with descriptive, conventional commit messages:
   ```bash
   git commit -m "feat(telemetry): add Modbus register reader for Liebert CDU"
   ```
3. Push to your branch and open a Pull Request against `main`. Provide a clear description and screenshot/screencast if UI components are modified.
