if (process.env.VITE_DEMO_MODE !== "true" && !process.env.VITE_REOWN_PROJECT_ID?.trim()) {
  console.error("VITE_REOWN_PROJECT_ID is required for production wallet connections.");
  process.exit(1);
}
