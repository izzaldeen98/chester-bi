import { useAuth } from '../contexts/AuthContext'
import AccessDenied from './AccessDenied'

interface RequirePermissionProps {
  /** One or more permission strings — access granted if the user holds ANY of them */
  permissions: string[]
  children: React.ReactNode
}

export default function RequirePermission({ permissions, children }: RequirePermissionProps) {
  const { hasPermission } = useAuth()

  if (!hasPermission(...permissions)) {
    return <AccessDenied permission={permissions[0]} />
  }

  return <>{children}</>
}
