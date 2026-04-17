# Plano de Implementação: White Label & PWA Dinâmico

Este documento descreve a estratégia para transformar o sistema em uma plataforma White Label, onde cada loja (tenant) possui sua própria identidade visual (logo/ícone) na tela de login e como ícone de instalação do PWA.

## 1. Arquitetura de Armazenamento

Para que o sistema seja escalável e dinâmico, utilizaremos o **Supabase** em vez de arquivos estáticos na pasta `public`.

### Supabase Storage
- **Bucket:** `branding` (público).
- **Estrutura:** `logos/{tenant_id}/logo.png` e `logos/{tenant_id}/icon.png`.

### Supabase Database
- **Tabela:** `stores` (ou a tabela que identifica a loja).
- **Novos Campos:**
  - `logo_url`: URL da imagem para a tela de login.
  - `icon_url`: URL da imagem quadrada para ícone de PWA/Favicon.
  - `primary_color`: (Opcional) Hexadecimal para personalizar botões e temas.

---

## 2. Experiência do Usuário (UX) & Login

### Primeiro Acesso
1. O usuário acessa a URL geral ou uma URL específica da loja.
2. A tela de login exibe a marca padrão (**StopCar**).
3. Após o login bem-sucedido, o sistema salva no `localStorage`:
   ```javascript
   {
     "tenant_name": "Auto Elétrica do Jaime",
     "tenant_logo": "https://.../supabase/.../logo.png",
     "tenant_icon": "https://.../supabase/.../icon.png"
   }
   ```

### Acessos Subsequentes
1. No carregamento da página de login, um `useEffect` verifica se existe um `tenant_logo` no `localStorage`.
2. Se existir, a logo do sistema é substituída pela logo da loja instantaneamente, antes mesmo do usuário digitar as credenciais.

---

## 3. PWA Dinâmico (Manifest.ts)

O Next.js permite gerar o manifesto do PWA dinamicamente.

### Estratégia:
- Criar `app/manifest.ts` que tenta identificar o tenant (via subdomínio ou via dados pré-carregados).
- Injetar metadados dinâmicos no `app/layout.tsx`:
  ```typescript
  // Exemplo no layout.tsx
  export async function generateMetadata({ params }) {
    const store = await getStoreData(params.id);
    return {
      title: store.name,
      icons: {
        icon: store.icon_url,
        apple: store.icon_url,
      },
      manifest: `/api/manifest?id=${store.id}`
    }
  }
  ```

---

## 4. Próximos Passos (Checklist)

- [ ] **Configuração Supabase:** Criar bucket `branding` e políticas de acesso (RLS).
- [ ] **Migração de Banco:** Adicionar colunas `logo_url` e `icon_url` na tabela de lojas.
- [ ] **Interface de Admin:** Criar tela para o dono da loja fazer upload das imagens.
- [ ] **Refatoração Login:** Implementar lógica de leitura do `localStorage` no componente de Login.
- [ ] **SEO & Meta:** Ajustar o `generateMetadata` para ler as logos dinâmicas.

---

> [!NOTE]
> Esta abordagem garante que o usuário tenha a sensação de estar usando um software exclusivo da própria loja, aumentando a percepção de valor do serviço prestado.
