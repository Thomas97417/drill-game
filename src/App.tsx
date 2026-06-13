import { GameCanvas } from './ui/GameCanvas';
import { HUD } from './ui/HUD';
import { Shop } from './ui/Shop';
import { Inventory } from './ui/Inventory';
import { Options } from './ui/Options';
import { RescueModal } from './ui/RescueModal';
import { Story } from './ui/Story';
import { Victory } from './ui/Victory';

export default function App() {
  return (
    <>
      <GameCanvas />
      <HUD />
      <Shop />
      <Inventory />
      <Options />
      <Story />
      <Victory />
      <RescueModal />
    </>
  );
}
