import { AppRegistry } from 'react-native';
import '@fontsource/big-shoulders-display/700';
import '@fontsource/big-shoulders-display/800';
import '@fontsource/cormorant-garamond/500';
import '@fontsource/cormorant-garamond/600';
import '@fontsource/cormorant-garamond/500-italic';
import '@fontsource/cormorant-garamond/600-italic';
import '@fontsource-variable/inter';
import '@fontsource/jetbrains-mono/400';
import '@fontsource/jetbrains-mono/500';
import './global.css';
import { Root } from './Root';

AppRegistry.registerComponent('Fieldnote', () => Root);
AppRegistry.runApplication('Fieldnote', { rootTag: document.getElementById('root') });
