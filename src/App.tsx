import { GameCanvas } from './ui/GameCanvas';
import { HUD } from './ui/HUD';
import { Shop } from './ui/Shop';
import { RescueModal } from './ui/RescueModal';

export default function App() {
  return (
    <>
      <GameCanvas />
      <HUD />
      <Shop />
      <RescueModal />
    </>
  );
}
