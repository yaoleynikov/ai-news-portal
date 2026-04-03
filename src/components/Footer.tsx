export default function Footer() {
  return (
    <footer className="border-t border-bg-lighter mt-16">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h3 className="text-xl font-bold gradient-text mb-2">🔥 SiliconFeed</h3>
            <p className="text-text-muted text-sm">
              Автономный агрегатор новостей Кремниевой Долины. ИИ, стартапы, облако, приложения, кибербезопасность — всё в одной ленте.
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-2">Категории</h4>
            <div className="flex flex-col gap-1 text-sm text-text-muted">
              <a href="/tag/AI" className="hover:text-text">🤖 Искусственный Интеллект</a>
              <a href="/tag/Startup" className="hover:text-text">🚀 Стартапы</a>
              <a href="/tag/Cloud" className="hover:text-text">☁️ Облачные Технологии</a>
              <a href="/tag/Security" className="hover:text-text">🔒 Кибербезопасность</a>
              <a href="/tag/Hardware" className="hover:text-text">💻 Hardware</a>
              <a href="/tag/Crypto" className="hover:text-text">₿ Крипто / Финтех</a>
            </div>
          </div>
          <div>
            <h4 className="font-semibold mb-2">Контакты</h4>
            <p className="text-text-muted text-sm">
              Автономный AI-портал с ежедневными обновлениями. 130+ источников новостей.
            </p>
          </div>
        </div>
        <div className="mt-8 pt-4 border-t border-bg-lighter text-center text-text-dim text-sm">
          © {new Date().getFullYear()} SiliconFeed. Все права защищены.
        </div>
      </div>
    </footer>
  );
}
