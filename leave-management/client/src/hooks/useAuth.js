// Re-export useAuth from AuthContext (Track A)
// This hook file exists so other tracks can import from hooks/useAuth
// without directly depending on contexts/AuthContext path.
import { useAuth } from '../contexts/AuthContext';
export default useAuth;
