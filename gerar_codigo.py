import os
import math

# --- CONFIGURAÇÃO ---

# Definição das regras: Pastas chaves e em quantas partes dividir
# Estrutura: "NOME_DO_ARQUIVO_BASE": {"chaves": [...], "partes": N}
CONFIG_DIVISAO = {
    "1_TELAS_E_ROTAS": {
        "chaves": ["src\\app", "src/app"], 
        "partes": 6  # AUMENTADO: Vai gerar partes A, B, C, D, E, F
    },
    "2_COMPONENTES_VISUAIS": {
        "chaves": ["src\\components", "src/components"], 
        "partes": 12  # AUMENTADO: Vai gerar até a parte L (arquivos bem menores)
    },
    "3_REGRAS_BANCO_DADOS": {
        "chaves": ["src\\lib", "src\\actions", "src/lib", "src/actions"], 
        "partes": 2  # AUMENTADO: Divide em 2 caso tenha muita lógica de backend
    },
    "4_CONFIGURACOES": {
        "chaves": ["package.json", "tsconfig.json", "next.config"], 
        "partes": 1  # Mantém arquivo único
    }
}

EXTENSOES_PERMITIDAS = ['.ts', '.tsx', '.sql', '.css', '.json', '.md']
IGNORAR_ARQUIVOS = ['package-lock.json', 'next-env.d.ts', 'yarn.lock']
IGNORAR_PASTAS = ['node_modules', '.next', '.git', '.vscode', 'dist', 'build']

def salvar_lote(nome_arquivo, lista_arquivos):
    """Função auxiliar para salvar uma lista de arquivos em um único .txt"""
    try:
        with open(nome_arquivo, 'w', encoding='utf-8') as outfile:
            outfile.write(f"=== CONTEÚDO PARCIAL: {nome_arquivo} ===\n")
            outfile.write(f"=== CONTÉM {len(lista_arquivos)} ARQUIVOS ===\n\n")

            for path_completo in lista_arquivos:
                try:
                    with open(path_completo, 'r', encoding='utf-8') as infile:
                        outfile.write(f"\n{'='*50}\n")
                        outfile.write(f"ARQUIVO: {path_completo}\n")
                        outfile.write(f"{'='*50}\n")
                        outfile.write(infile.read())
                        outfile.write("\n")
                except Exception as e:
                    outfile.write(f"\n[ERRO AO LER {path_completo}: {e}]\n")
        
        print(f"✅ Gerado: {nome_arquivo} ({len(lista_arquivos)} arquivos)")
    except Exception as e:
        print(f"❌ Erro fatal ao criar {nome_arquivo}: {e}")

def processar_projeto():
    # Dicionário para agrupar os caminhos dos arquivos antes de salvar
    arquivos_agrupados = {k: [] for k in CONFIG_DIVISAO.keys()}
    arquivos_agrupados["4_CONFIGURACOES"] = [] # Garante inicialização

    print("🔍 Escaneando diretórios...")

    # 1. COLETA (VARREDURA)
    for root, dirs, files in os.walk('.'):
        # Remove pastas ignoradas
        for ignore in IGNORAR_PASTAS:
            if ignore in dirs: dirs.remove(ignore)

        for file in files:
            ext = os.path.splitext(file)[1]
            path_completo = os.path.join(root, file)
            
            # Filtros básicos
            if ext not in EXTENSOES_PERMITIDAS or file in IGNORAR_ARQUIVOS:
                continue

            # Lógica de Classificação
            categoria_encontrada = None
            
            # Verifica nas regras específicas
            for nome_base, regras in CONFIG_DIVISAO.items():
                if any(chave in path_completo for chave in regras["chaves"]):
                    categoria_encontrada = nome_base
                    break
            
            # Se não achou categoria, verifica se é config da raiz
            if not categoria_encontrada:
                if "src" not in path_completo:
                     # Se for arquivo de raiz importante, joga em config
                     if file in ["package.json", "next.config.ts", "next.config.js", "tailwind.config.js", "tsconfig.json", "middleware.ts"]:
                         categoria_encontrada = "4_CONFIGURACOES"
            
            # Adiciona à lista se encontrou categoria
            if categoria_encontrada:
                arquivos_agrupados[categoria_encontrada].append(path_completo)

    print("📦 Organizando e dividindo arquivos...")

    # 2. DIVISÃO E SALVAMENTO
    for nome_base, lista_arquivos in arquivos_agrupados.items():
        if not lista_arquivos:
            continue

        # Ordena para manter coerência (alfabética)
        lista_arquivos.sort()

        qtd_partes = CONFIG_DIVISAO[nome_base]["partes"]
        total_arquivos = len(lista_arquivos)

        # Se for para salvar em 1 arquivo só
        if qtd_partes == 1:
            nome_final = f"{nome_base}.txt"
            salvar_lote(nome_final, lista_arquivos)
        
        # Se for para dividir (Multi-partes)
        else:
            # Ajuste de segurança: Se tiver menos arquivos que partes, ajusta partes
            if total_arquivos < qtd_partes:
                qtd_partes = total_arquivos

            # Calcula tamanho do pedaço (chunk)
            tamanho_pedaco = math.ceil(total_arquivos / qtd_partes)
            
            for i in range(qtd_partes):
                # Define sufixo: A, B, C, D...
                sufixo = chr(65 + i) # 65 é ASCII para 'A'
                nome_final = f"{nome_base}_PARTE_{sufixo}.txt"
                
                # Fatiar a lista (Slicing)
                inicio = i * tamanho_pedaco
                fim = (i + 1) * tamanho_pedaco
                lote_atual = lista_arquivos[inicio:fim]

                if lote_atual:
                    salvar_lote(nome_final, lote_atual)

if __name__ == "__main__":
    processar_projeto()