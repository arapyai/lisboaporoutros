import type { Meta, StoryObj } from '@storybook/react';
import { cityConfig } from '../config/city';

function DesignOverview() {
  const cartografia = cityConfig.theme.id === 'cartografia-poetica';
  const colors = cartografia ? [
    ['Branco', '#ffffff'],
    ['Preto', '#171717'],
    ['Amarelo', '#f5c518'],
    ['Cinza cartográfico', '#858585']
  ] : [
    ['Paper', '#f4efe7'],
    ['Ink', '#16211f'],
    ['Green', '#163832'],
    ['Green 2', '#23564c'],
    ['Clay', '#c45732'],
    ['Blue', '#315f7d'],
    ['Line', '#d8d0c4']
  ];

  return (
    <main style={{ padding: 32, color: 'var(--ink)' }}>
      <section style={{ maxWidth: 960 }}>
        <h1 style={{ marginTop: 0, fontFamily: 'var(--font-display)', fontWeight: 400 }}>
          {cartografia ? 'Cartografia Poética' : cityConfig.appName}
        </h1>
        <p style={{ color: 'var(--muted)', lineHeight: 1.5 }}>
          Catalogo dos elementos visuais usados no PWA: selecao de idioma, player, detalhe de ponto, mapa e telas
          principais.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12 }}>
          {colors.map(([name, value]) => (
            <article key={name} style={{ border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ height: 82, background: value }} />
              <div style={{ padding: 10, background: 'var(--panel)' }}>
                <strong>{name}</strong>
                <small style={{ display: 'block', color: 'var(--muted)' }}>{value}</small>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

const meta = {
  title: 'Design/Overview',
  component: DesignOverview,
  parameters: {
    layout: 'fullscreen'
  }
} satisfies Meta<typeof DesignOverview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {};
