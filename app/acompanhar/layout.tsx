import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Portal do Cliente | Autoelétrica Pro',
    description: 'Acompanhe o status do seu veículo e veja o seu orçamento detalhado em tempo real.',
    openGraph: {
        title: 'Acompanhe seu Serviço - Autoelétrica Pro',
        description: 'Veja agora as atualizações e orçamento do seu veículo na palma da mão.',
        url: 'https://autoeletricapro.com.br/acompanhar', // Pode ajustar sua url de produção aqui
        siteName: 'Autoelétrica Pro',
        images: [
            {
                url: '/web-app-manifest-512x512.png',
                width: 512,
                height: 512,
                alt: 'Logo Autoelétrica Pro',
            },
        ],
        locale: 'pt_BR',
        type: 'website',
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Acompanhe seu Serviço - Autoelétrica Pro',
        description: 'Veja agora as atualizações e orçamento do seu veículo na palma da mão.',
        images: ['/web-app-manifest-512x512.png'],
    },
};

export default function AcompanharLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}
