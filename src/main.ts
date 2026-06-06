import './styles/theme.css';
import { mount } from 'svelte';
import App from './App.svelte';
import { readResolvedTheme } from './store/settings.svelte';

document.documentElement.setAttribute('data-theme', readResolvedTheme());

const app = mount(App, { target: document.getElementById('app')! });
export default app;
