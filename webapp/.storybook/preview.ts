import type { Preview } from '@storybook/react-vite';
import { cityConfig } from '../src/config/city';
import '../src/styles/global.css';
import '../src/styles/cartografia.css';

document.documentElement.dataset.theme = cityConfig.theme.id;

const preview: Preview = {
  parameters: {
    layout: 'fullscreen',
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i
      }
    },
    backgrounds: {
      default: cityConfig.theme.id === 'cartografia-poetica' ? 'white' : 'paper',
      values: [
        { name: 'paper', value: '#f4efe7' },
        { name: 'white', value: '#ffffff' },
        { name: 'green', value: '#163832' }
      ]
    }
  }
};

export default preview;
