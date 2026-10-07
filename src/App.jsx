import { useCallback, useEffect, useState } from 'react';
import { indexOf } from './data.js';
import { ErrorScreen, Join, Loading, PickPlayers, Setup } from './screens/Gate.jsx';
import Home from './screens/Home.jsx';
import Admin from './screens/Admin.jsx';
import { Install, More, Players, Rules } from './screens/More.jsx';
import { Calendar, FullSchedule, Results } from './screens/MotoGP.jsx';
import Porra from './screens/Porra.jsx';
import Vote from './screens/Vote.jsx';
import { init, now, refresh, useStore } from './store.js';
import { BottomNav, cameFrom, PlayerSheet, SheetContext, TopBar, useRoute } from './ui.jsx';

function Ready() {
  const { boot, active } = useStore();
  const route = useRoute();
  const [sheet, setSheet] = useState(false);
  const openSheet = useCallback(() => setSheet(true), []);
  const closeSheet = useCallback(() => setSheet(false), []);

  // Datos frescos al volver a la app y cada dos minutos mientras está a la vista.
  useEffect(() => {
    const onShow = () => document.visibilityState === 'visible' && refresh();
    document.addEventListener('visibilitychange', onShow);
    window.addEventListener('online', onShow);
    const id = setInterval(onShow, 120000);
    return () => {
      document.removeEventListener('visibilitychange', onShow);
      window.removeEventListener('online', onShow);
      clearInterval(id);
    };
  }, []);

  const d = indexOf(boot);
  const voting = d.events.get(boot.voting_event_id);
  const voteDot = !!voting && Date.parse(voting.close_at) > now() && !d.voteOf(active, voting.id);
  const [a, b, c] = route;

  let tab = '';
  let screen;
  if (a === 'votar') {
    tab = 'votar';
    screen = <Vote changing={b === 'cambiar'} />;
  } else if (a === 'porra') {
    tab = 'porra';
    screen = <Porra tab={b === 'gp' ? 'gp' : 'general'} />;
  } else if (a === 'motogp') {
    tab = 'motogp';
    screen = b === 'calendario' ? <Calendar /> : <Results key={b === 'r' ? c : 'auto'} eventId={b === 'r' ? c : null} />;
  } else if (a === 'horario') {
    tab = cameFrom() === 'motogp' ? 'motogp' : '';
    screen = <FullSchedule eventId={b} />;
  } else if (a === 'mas') {
    tab = 'mas';
    screen = b === 'jugadores' ? <Players /> : b === 'reglas' ? <Rules /> : b === 'instalar' ? <Install /> : b === 'admin' ? <Admin /> : <More />;
  } else {
    screen = (
      <>
        <TopBar />
        <main className="main has-nav">
          <Home />
        </main>
      </>
    );
  }

  // Al elegir piloto la barra inferior deja sitio al botón de confirmar.
  const picking = a === 'votar' && !!voting && Date.parse(voting.close_at) > now() && (!d.voteOf(active, voting.id) || (b === 'cambiar' && d.voteOf(active, voting.id).changes_used < 1));

  return (
    <SheetContext.Provider value={openSheet}>
      {screen}
      {picking ? null : <BottomNav current={tab} voteDot={voteDot} />}
      {sheet ? <PlayerSheet onClose={closeSheet} /> : null}
    </SheetContext.Provider>
  );
}

export default function App() {
  const { phase } = useStore();
  useEffect(() => {
    init();
  }, []);
  let body;
  if (phase === 'ready') body = <Ready />;
  else if (phase === 'setup') body = <Setup />;
  else if (phase === 'join') body = <Join />;
  else if (phase === 'pick') body = <PickPlayers />;
  else if (phase === 'error') body = <ErrorScreen />;
  else body = <Loading />;
  return <div className="app">{body}</div>;
}
