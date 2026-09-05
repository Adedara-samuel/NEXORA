export interface Permission {
  id: string;
  key: string;
  description: string;
  category: string;
}

export interface Role {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: string[];
}
