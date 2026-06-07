async function handleLogin(e: React.FormEvent) {
  e.preventDefault();
  setLoading(true);
  setError("");
  await new Promise((r) => setTimeout(r, 400));
  if (email === "mz@crm.uz" && password === "mz1313") {
    document.cookie = `crm_session=authenticated; path=/; max-age=2592000; SameSite=Lax`;
    router.push("/dashboard");
    router.refresh();
  } else {
    setError("Email yoki parol noto'g'ri");
    setLoading(false);
  }
}
