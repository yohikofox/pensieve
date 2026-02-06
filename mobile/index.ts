import 'reflect-metadata'; // MUST be first for TSyringe decorators
import 'react-native-get-random-values';
import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';

// Global side effects
import './global.css';
import './src/i18n';

// Bootstrap app configuration FIRST, before any component imports
import { bootstrap } from './src/config/bootstrap';
bootstrap();

// Import App AFTER bootstrap to ensure DI container is ready
import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
