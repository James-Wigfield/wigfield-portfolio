/* The three mechanism rooms. Each mounts once with the scene and idles when
   the philosopher is elsewhere; their moving parts register with the world. */
import { HouseWindow } from './houseWindow';
import { HouseEyes } from './houseEyes';
import { HouseDoor } from './houseDoor';

export function Rooms() {
  return (
    <>
      <HouseWindow />
      <HouseEyes />
      <HouseDoor />
    </>
  );
}
