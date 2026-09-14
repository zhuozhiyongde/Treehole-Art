import { AppView } from './app/AppView';
import { useAppController } from './app/useAppController';

function App() {
    const controller = useAppController();
    return <AppView controller={controller} />;
}

export default App;
