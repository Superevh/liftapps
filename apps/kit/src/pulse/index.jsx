import { TeamRoom } from './Team.jsx'
import { CheckRoom } from './Check.jsx'

export { PulseHome } from './Home.jsx'

// One route for every PulseLift document: #/health/<id>[/<tab>]. Team ids start with "lftm";
// everything else is a health check, including links shared before team spaces existed.
export function PulseRoom({ id, sub }) {
  return id.startsWith('lftm') ? <TeamRoom id={id} sub={sub} /> : <CheckRoom id={id} />
}
