import { ArrowUpRight, Headphones, MapPin, BookOpen } from 'lucide-react';
import type { Lang } from '../types';

const copy = {
  pt: {
    label: 'SOBRE O PROJETO', title: 'Há muitas Lisboas\nà sua espera.',
    intro: 'Uma cidade também se descobre pelas palavras de quem a escreve. Lisboa por Outros convida a percorrer ruas, lugares e memórias pela literatura.',
    heading: 'Um mapa para ler.\nUma cidade para ouvir.',
    body: 'Entre um largo e uma esquina, há histórias que mudam a forma como olhamos para a cidade. Aqui, os lugares de Lisboa encontram as vozes de autores que os viveram, imaginaram e transformaram em texto.',
    body2: 'Explore o mapa, descubra autores e siga percursos literários ao seu ritmo. Pare para ler, escute um texto e deixe que um outro olhar acompanhe o seu caminho.',
    features: [ ['Lugares com histórias', 'Encontre textos ligados aos lugares por onde passa.'], ['Literatura para escutar', 'Leia e ouça a cidade, com conteúdos em diferentes idiomas.'], ['Caminhos por descobrir', 'Siga percursos que aproximam autores, textos e lugares.'] ],
    recognition: 'PROJETO PREMIADO', recognitionText: 'Projeto premiado no âmbito do Programa Lisboa, Cultura e Media da Lisboa Cultura.', support: 'APOIO', footer: 'Lisboa por Outros · A Cidade Escrita em Voz Alta.', action: 'Explorar o mapa',
  },
  en: {
    label: 'ABOUT THE PROJECT', title: 'Many Lisbons\nare waiting for you.',
    intro: 'You can discover a city through the words of those who write it. Lisboa por Outros invites you to explore streets, places and memories through literature.',
    heading: 'A map to read.\nA city to listen to.',
    body: 'Between a square and a street corner, stories change the way we see the city. Here, places in Lisbon meet the voices of authors who lived them, imagined them and turned them into words.',
    body2: 'Explore the map, discover authors and follow literary routes at your own pace. Pause to read, listen to a text and let a different perspective accompany your walk.',
    features: [ ['Places with stories', 'Find texts connected to the places you visit.'], ['Literature to listen to', 'Read and listen to the city, with content in different languages.'], ['Paths to discover', 'Follow routes connecting authors, texts and places.'] ],
    recognition: 'AWARD RECOGNITION', recognitionText: 'This project received an award under the Programa Lisboa, Cultura e Media by Lisboa Cultura.', support: 'SUPPORTED BY', footer: 'Lisboa por Outros · The City Written Aloud.', action: 'Explore the map',
  },
};

export function AboutPage({ lang, onExplore }: { lang: Lang; onExplore: () => void }) {
  const text = copy[lang === 'en' ? 'en' : 'pt'];
  const icons = [MapPin, Headphones, BookOpen];
  return (
    <main className="about-page" lang={lang === 'en' ? 'en' : 'pt'}>
      <section className="about-hero" aria-labelledby="about-title">
        <div className="about-hero-copy">
          <span className="about-eyebrow">{text.label}</span>
          <h1 id="about-title">{text.title}</h1>
          <p>{text.intro}</p>
          <button className="about-explore" type="button" onClick={onExplore}>{text.action}<ArrowUpRight size={18} /></button>
        </div>
        <div className="about-photo" role="img" aria-label={lang === 'en' ? 'View of Lisbon' : 'Vista de Lisboa'} />
      </section>
      <section className="about-story">
        <h2>{text.heading}</h2>
        <div><p>{text.body}</p><p>{text.body2}</p></div>
      </section>
      <section className="about-features" aria-label={lang === 'en' ? 'Discover the project' : 'Descubra o projeto'}>
        {text.features.map(([title, description], index) => {
          const Icon = icons[index];
          return <article key={title}><Icon size={23} strokeWidth={1.5} /><h3>{title}</h3><p>{description}</p></article>;
        })}
      </section>
      <footer className="about-footer">
        <div className="about-credits">
        <div className="about-recognition">
          <div><span className="about-eyebrow">{text.recognition}</span><p>{text.recognitionText}</p></div>
          <img src="/branding/lisboa-cultura-media.svg" alt="Lisboa Cultura e Media" />
        </div>
        <div className="about-support">
          <span className="about-eyebrow">{text.support}</span>
          <a href="https://www.josesaramago.org/">
            <img src="/branding/fundacao-jose-saramago.svg" alt="Fundação José Saramago" />
          </a>
        </div>
        </div>
        <p>{text.footer}</p>
      </footer>
    </main>
  );
}
