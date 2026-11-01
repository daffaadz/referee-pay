export default function HomePage() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-8 text-center">
      <h1 className="text-4xl font-extrabold tracking-tight">Referee</h1>
      <p className="mt-4 text-lg text-gray-600 dark:text-gray-400 max-w-xl">
        Proactive, explainable AI arbiter holding buyer funds via PayPal until delivery is verified
        on the web.
      </p>
      <div className="mt-6 flex gap-4">
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
          PayPal Sandbox
        </span>
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
          Kernel Browser
        </span>
      </div>
    </main>
  );
}

