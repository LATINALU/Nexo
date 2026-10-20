import {
    Rocket, Code2, Scale, LineChart, Megaphone, BookOpen, DollarSign, Map,
    Search, RefreshCw, AlertTriangle, Palette, Database, Target, GraduationCap,
    Users, Briefcase, TrendingUp, Shield, Zap, Globe, Package, FileText,
    MessageSquare, PieChart, Settings, Cloud, Smartphone, Video, ShoppingCart,
    Heart, Music, Camera, Plane, Coffee, Home, Car, Book, Lightbulb, Trophy,
    Star, Gift, Bell, Mail, Phone, Calendar, Clock, Flag, Hash, Percent, Boxes,
    Building2, Workflow, CheckCircle2, BarChart3, Repeat, Network, Layers, Youtube,
    Gamepad2, Cpu, Radio, Wrench, Leaf, Brain, Mic, Headphones, MonitorPlay,
    Wallet, Lock, FileCode, PenTool, Compass, Hammer, Factory, Truck, Ship,
    Landmark, Store, BadgeDollarSign, Glasses, Sparkles, CircuitBoard, Clapperboard
} from "lucide-react";

// Nexo - 100 Tareas Predefinidas Multi-Categoria (Entorno Real)
// Cada tarea combina agentes de DIFERENTES categorias para resolver problemas reales
export const PRESETS = [

    // 
    //  LANZAMIENTO DE STARTUP & NEGOCIOS (1-10)
    // ═
    {
        title: "Lanzar SaaS B2B desde Cero",
        description: "Arquitectura, MVP, pricing, legal y go-to-market para SaaS empresarial",
        icon: Rocket,
        agents: ["fullstack_developer", "backend_architect", "product_manager_startup", "financial_analyst", "legal_startup", "growth_hacker", "copywriter"]
    },
    {
        title: "Pitch Deck para Inversionistas",
        description: "Presentacion financiera, narrativa y diseno para levantar capital",
        icon: Briefcase,
        agents: ["pitch_coach", "financial_analyst", "brand_designer", "data_storyteller", "startup_advisor", "copywriter_pro"]
    },
    {
        title: "Validar Idea de Negocio",
        description: "Investigacion de mercado, MVP lean, modelo financiero y estrategia",
        icon: Lightbulb,
        agents: ["lean_startup_coach", "market_entry", "business_model", "financial_coach", "product_manager_startup", "data_scientist"]
    },
    {
        title: "Constituir Empresa y Compliance",
        description: "Estructura legal, fiscal, contratos y propiedad intelectual",
        icon: Scale,
        agents: ["legal_startup", "corporate_lawyer", "intellectual_property", "tax_specialist", "compliance_officer", "intl_tax"]
    },
    {
        title: "Plan de Negocio Completo",
        description: "Business plan con proyecciones financieras, mercado y operaciones",
        icon: FileText,
        agents: ["business_model", "financial_analyst", "market_entry", "operations_manager", "strategy_consultant", "proposal_writer"]
    },
    {
        title: "Fundraising Serie A",
        description: "Estrategia de levantamiento de capital, due diligence y negociacion",
        icon: BadgeDollarSign,
        agents: ["fundraising_expert", "financial_controller", "ma_advisor", "pitch_coach", "corporate_lawyer", "startup_advisor"]
    },
    {
        title: "Estrategia de Precios SaaS",
        description: "Pricing tiers, analisis competitivo, psicologia de precios y metricas",
        icon: Percent,
        agents: ["pricing_consultant", "saas_growth", "financial_analyst", "conversion_optimizer", "data_scientist", "sales_analyst"]
    },
    {
        title: "MVP Mobile App Startup",
        description: "App movil rapida con backend, diseno UX y plan de lanzamiento",
        icon: Smartphone,
        agents: ["mobile_developer", "ux_designer", "backend_architect", "lean_startup_coach", "aso_specialist", "qa_automation"]
    },
    {
        title: "Expansion Internacional",
        description: "Estrategia de entrada a nuevos mercados, legal y localizacion",
        icon: Globe,
        agents: ["market_entry", "intl_legal", "intl_tax", "translation_expert", "cross_cultural", "export_consultant"]
    },
    {
        title: "Exit Strategy M&A",
        description: "Preparar empresa para venta, valoracion y proceso de due diligence",
        icon: Trophy,
        agents: ["exit_strategist", "ma_advisor", "financial_controller", "corporate_lawyer", "auditor", "strategy_consultant"]
    },

    // 
    //  E-COMMERCE & RETAIL DIGITAL (11-20)
    // 
    {
        title: "Tienda Shopify Premium",
        description: "Ecommerce completo con SEO, conversion, pagos y logistica",
        icon: ShoppingCart,
        agents: ["shopify_expert", "ecommerce_strategist", "ecommerce_seo", "conversion_optimizer", "payment_systems_expert", "ui_designer"]
    },
    {
        title: "Dropshipping Rentable",
        description: "Modelo dropshipping con proveedores, ads y automatizacion",
        icon: Package,
        agents: ["dropshipping_specialist", "ecommerce_strategist", "ppc_specialist", "supply_chain_analyst", "email_automation", "social_media_manager"]
    },
    {
        title: "Marketplace en MercadoLibre",
        description: "Dominar MercadoLibre: publicaciones, ads, reputacion y analytics",
        icon: Star,
        agents: ["ml_listing_optimizer", "ml_ads_specialist", "ml_reputation_manager", "ml_analytics_expert", "ml_pricing_strategist", "ml_customer_service"]
    },
    {
        title: "Email Marketing Ecommerce",
        description: "Flujos automatizados, carritos abandonados, segmentacion y retencion",
        icon: Mail,
        agents: ["email_automation", "email_marketer", "email_writer", "ecommerce_strategist", "conversion_optimizer", "data_scientist"]
    },
    {
        title: "Logistica y Fulfillment",
        description: "Cadena de suministro, almacen, envios y logistica inversa",
        icon: Truck,
        agents: ["warehouse_manager", "logistics_coordinator", "supply_chain_analyst", "inventory_specialist", "reverse_logistics", "demand_planner"]
    },
    {
        title: "Conversion Rate Optimization",
        description: "Optimizar funnel de compra, A/B testing, UX y analytics",
        icon: TrendingUp,
        agents: ["conversion_optimizer", "ux_researcher", "data_scientist", "conversion_designer", "analytics_expert", "copywriter"]
    },
    {
        title: "Catalogo ML + Logistica Full",
        description: "Gestion de catalogo MercadoLibre con envios y fulfillment",
        icon: Boxes,
        agents: ["ml_catalog_manager", "ml_logistics_expert", "ml_listing_optimizer", "inventory_analyst", "demand_planner", "mercadolibre_product_specialist"]
    },
    {
        title: "Modelo de Suscripcion",
        description: "Negocio de suscripcion recurrente: churn, LTV, retention",
        icon: Repeat,
        agents: ["subscription_specialist", "saas_growth", "financial_analyst", "email_automation", "customer_success", "data_scientist"]
    },
    {
        title: "Expansion Ecommerce Global",
        description: "Vender internacionalmente: aduanas, pagos, localizacion",
        icon: Ship,
        agents: ["export_consultant", "customs_specialist", "international_seo", "payment_systems_expert", "intl_logistics", "translation_expert"]
    },
    {
        title: "Estrategia Omnicanal",
        description: "Integrar tienda online, marketplace, redes sociales y tienda fisica",
        icon: Layers,
        agents: ["ecommerce_strategist", "channel_manager", "social_media_manager", "crm_specialist", "inventory_specialist", "marketplace_manager_ecom"]
    },

    // 
    //  CONTENIDO, YOUTUBE & MEDIA (21-30)
    // 
    {
        title: "Canal YouTube Profesional",
        description: "Estrategia completa: contenido, SEO, thumbnails, monetizacion",
        icon: Youtube,
        agents: ["yt_content_strategist", "yt_seo_specialist", "yt_thumbnail_designer", "yt_monetization_expert", "yt_script_writer", "yt_growth_strategist"]
    },
    {
        title: "Podcast de Autoridad",
        description: "Produccion de podcast profesional con distribucion y monetizacion",
        icon: Mic,
        agents: ["podcast_producer", "podcast_host", "audio_engineer", "content_strategist", "social_media_manager", "brand_strategist"]
    },
    {
        title: "Produccion Musical Completa",
        description: "Composicion, produccion, mezcla, mastering y distribucion",
        icon: Music,
        agents: ["music_producer", "music_composer", "mixing_engineer", "mastering_engineer", "music_distributor", "music_marketing"]
    },
    {
        title: "Streaming en Twitch/YT",
        description: "Setup profesional de streaming, comunidad y monetizacion",
        icon: MonitorPlay,
        agents: ["twitch_streamer", "obs_specialist", "stream_moderator", "yt_community_manager", "monetization_streamer", "live_producer"]
    },
    {
        title: "Contenido Viral TikTok + Reels",
        description: "Estrategia de contenido corto viral para TikTok e Instagram",
        icon: Clapperboard,
        agents: ["tiktok_creator", "instagram_reels", "yt_shorts_specialist", "content_repurposer", "social_media_manager", "copywriter"]
    },
    {
        title: "Libro y Publicacion Digital",
        description: "Escribir, editar, publicar y promocionar un libro",
        icon: Book,
        agents: ["ghostwriter", "editor_chief", "book_publisher", "content_writer", "brand_strategist", "social_media_manager"]
    },
    {
        title: "Video Marketing Corporativo",
        description: "Videos corporativos, produccion, animacion y distribucion",
        icon: Video,
        agents: ["video_producer", "motion_designer", "scriptwriter", "sound_designer", "brand_designer", "social_media_manager"]
    },
    {
        title: "Marca Personal de Autoridad",
        description: "Construir marca personal como referente de industria",
        icon: Star,
        agents: ["thought_leader_coach", "linkedin_strategist", "content_creator_personal", "public_speaker_coach", "brand_coach", "speech_writer"]
    },
    {
        title: "Newsletter y Blog Monetizable",
        description: "Crear newsletter/blog con contenido SEO y modelo de negocio",
        icon: Mail,
        agents: ["content_strategist", "content_seo", "email_writer", "seo_specialist", "subscription_specialist", "copywriter_pro"]
    },
    {
        title: "Produccion de Cortometraje",
        description: "Guion, storyboard, produccion audiovisual y post-produccion",
        icon: Camera,
        agents: ["scriptwriter", "creative_director", "video_producer", "sound_designer", "animator", "music_composer"]
    },

    // 
    //  TRANSFORMACION DIGITAL EMPRESARIAL (31-40)
    // 
    {
        title: "Migrar a Cloud AWS/GCP",
        description: "Migracion completa a la nube con seguridad y optimizacion de costos",
        icon: Cloud,
        agents: ["devops_engineer", "kubernetes_expert", "terraform_expert", "security_specialist", "docker_specialist", "backend_architect"]
    },
    {
        title: "Data Warehouse Empresarial",
        description: "Arquitectura de datos, ETL, dashboards y gobernanza",
        icon: Database,
        agents: ["data_engineer", "etl_developer", "bi_architect", "data_governance", "powerbi_expert", "data_modeler"]
    },
    {
        title: "Ciberseguridad Corporativa",
        description: "Auditoria de seguridad, pentesting, SOC y respuesta a incidentes",
        icon: Shield,
        agents: ["pentester", "soc_analyst", "network_security", "malware_analyst", "red_team_leader", "forensic_analyst"]
    },
    {
        title: "CRM y Automatizacion Ventas",
        description: "Implementar CRM, automatizar pipeline y metricas de ventas",
        icon: Users,
        agents: ["crm_specialist", "sales_engineer", "process_automation", "email_automation", "sales_analyst", "customer_success"]
    },
    {
        title: "BI Dashboard Ejecutivo",
        description: "Dashboards interactivos para C-level con KPIs en tiempo real",
        icon: BarChart3,
        agents: ["powerbi_expert", "tableau_expert", "kpi_designer", "data_storyteller", "bi_architect", "looker_specialist"]
    },
    {
        title: "API Platform y Microservicios",
        description: "Plataforma de APIs con gateway, documentacion y monitoring",
        icon: Zap,
        agents: ["backend_architect", "devops_engineer", "security_specialist", "tech_lead", "api_tester", "integration_engineer"]
    },
    {
        title: "Automatizacion RPA Empresarial",
        description: "Automatizar procesos manuales con bots RPA y workflows",
        icon: Settings,
        agents: ["rpa_developer", "process_automation", "workflow_architect", "n8n_specialist", "zapier_expert", "process_optimizer"]
    },
    {
        title: "Machine Learning en Produccion",
        description: "Pipeline ML completo: datos, entrenamiento, deploy y monitoreo",
        icon: Brain,
        agents: ["ml_engineer", "mlops_engineer", "data_scientist", "deep_learning_specialist", "data_engineer", "devops_engineer"]
    },
    {
        title: "Chatbot IA Multicanal",
        description: "Chatbot inteligente para web, WhatsApp y redes sociales",
        icon: MessageSquare,
        agents: ["chatbot_developer", "nlp_engineer", "rag_architect", "voice_ai_expert", "ux_writer", "integration_engineer"]
    },
    {
        title: "Digital Transformation Roadmap",
        description: "Plan integral de transformacion digital para empresa tradicional",
        icon: Map,
        agents: ["digital_transformation", "strategy_consultant", "management_consultant", "org_change_manager", "it_consultant", "process_optimizer"]
    },

    // 
    //  REAL ESTATE & CONSTRUCCION (41-50)
    // 
    {
        title: "Desarrollo Inmobiliario",
        description: "Proyecto de desarrollo: analisis, financiamiento y construccion",
        icon: Building2,
        agents: ["real_estate_developer", "construction_manager", "financial_analyst", "real_estate_legal", "architectural_designer", "appraisal_expert"]
    },
    {
        title: "Inversion en Bienes Raices",
        description: "Portfolio de inversiones inmobiliarias: analisis y ROI",
        icon: Home,
        agents: ["real_estate_investor", "mortgage_advisor", "financial_analyst", "property_manager", "rental_strategist", "tax_specialist"]
    },
    {
        title: "Edificio Sustentable LEED",
        description: "Diseno y construccion verde con certificacion sustentable",
        icon: Leaf,
        agents: ["green_building", "architectural_designer", "sustainability_consultant", "energy_auditor", "construction_tech", "bim_specialist"]
    },
    {
        title: "PropTech Startup",
        description: "Startup tecnologica para el sector inmobiliario",
        icon: Landmark,
        agents: ["proptech_consultant", "fullstack_developer", "real_estate_marketing", "product_manager_startup", "ux_designer", "lean_startup_coach"]
    },
    {
        title: "Infraestructura Civil",
        description: "Diseno estructural, geotecnia, vias y servicios",
        icon: Hammer,
        agents: ["structural_engineer", "geotechnical_eng", "highway_engineer", "bridge_engineer", "hydraulic_engineer", "construction_manager"]
    },
    {
        title: "Smart Building IoT",
        description: "Edificio inteligente con sensores, automatizacion y eficiencia",
        icon: CircuitBoard,
        agents: ["iot_architect", "sensor_specialist", "building_inspector", "energy_auditor", "plc_programmer", "construction_tech"]
    },
    {
        title: "Marketing Inmobiliario",
        description: "Estrategia de marketing para proyectos inmobiliarios",
        icon: Megaphone,
        agents: ["real_estate_marketing", "content_strategist", "social_media_manager", "video_producer", "copywriter_pro", "ppc_specialist"]
    },
    {
        title: "Planificacion Urbana",
        description: "Desarrollo urbano sustentable, transporte y paisajismo",
        icon: Map,
        agents: ["urban_planner", "transport_planner", "landscape_architect", "sustainability_consultant", "environmental_eng", "surveyor"]
    },
    {
        title: "Auditoria de Obra Civil",
        description: "Inspeccion, calidad, seguridad y presupuesto de construccion",
        icon: CheckCircle2,
        agents: ["building_inspector", "cost_estimator", "safety_engineer", "quality_engineer", "construction_manager", "surveyor"]
    },
    {
        title: "Gestion de Propiedades",
        description: "Administracion de cartera inmobiliaria y rentas",
        icon: Home,
        agents: ["property_manager", "rental_strategist", "real_estate_legal", "financial_controller", "maintenance_engineer", "customer_success"]
    },

    // 
    //  GAMING & ENTRETENIMIENTO INTERACTIVO (51-60)
    // 
    {
        title: "Videojuego Indie Unity",
        description: "Desarrollo completo de videojuego indie en Unity",
        icon: Gamepad2,
        agents: ["unity_developer", "game_designer", "game_artist", "game_sound", "narrative_designer", "game_qa"]
    },
    {
        title: "Juego Mobile F2P",
        description: "Juego movil free-to-play con monetizacion y analytics",
        icon: Smartphone,
        agents: ["mobile_game_dev", "game_monetization", "game_designer", "mobile_ui", "analytics_expert", "aso_specialist"]
    },
    {
        title: "Experiencia VR/AR Inmersiva",
        description: "Aplicacion de realidad virtual/aumentada interactiva",
        icon: Glasses,
        agents: ["vr_developer", "ar_developer", "modeler_3d_xr", "xr_designer", "spatial_audio", "xr_performance"]
    },
    {
        title: "Juego Multiplayer Online",
        description: "Backend de juego online con matchmaking y sincronizacion",
        icon: Network,
        agents: ["multiplayer_dev", "unity_developer", "backend_architect", "networking_expert", "game_qa", "devops_engineer"]
    },
    {
        title: "Produccion de Video Profesional",
        description: "Guion, direccion, edicion y post-produccion de video completo",
        icon: Clapperboard,
        agents: ["video_director", "video_scriptwriter", "video_editor_script", "video_narrator", "video_sequence_designer", "video_concept_artist"]
    },
    {
        title: "Juego Unreal AAA",
        description: "Desarrollo de juego de alta calidad en Unreal Engine",
        icon: Gamepad2,
        agents: ["unreal_developer", "shader_programmer", "game_designer", "game_artist", "simulation_dev", "game_sound"]
    },
    {
        title: "Game Design Document",
        description: "Documento de diseno de juego completo con mecanicas y narrativa",
        icon: FileText,
        agents: ["game_designer", "narrative_designer", "game_monetization", "game_artist", "ux_designer", "creative_writer"]
    },
    {
        title: "Contenido de Video Corto Viral",
        description: "Shorts, Reels y TikToks virales con guion y prompts de IA",
        icon: Youtube,
        agents: ["video_shorts_creator", "video_prompt_expert", "video_dialogue_writer", "video_story_creator", "tiktok_creator", "instagram_reels"]
    },
    {
        title: "Metaverso y Web3 Gaming",
        description: "Juego blockchain con NFTs, tokenomics y mundo virtual",
        icon: Sparkles,
        agents: ["metaverse_architect", "nft_developer", "tokenomics_expert", "unity_developer", "solidity_dev", "game_designer"]
    },
    {
        title: "Game Review & Contenido",
        description: "Resenas, guias y contenido gaming multiplataforma",
        icon: Star,
        agents: ["video_director", "video_scriptwriter", "yt_script_writer", "video_producer", "social_media_manager", "content_repurposer"]
    },

    // 
    //  SALUD, CIENCIA & EDUCACION (61-70)
    // 
    {
        title: "Plataforma eLearning",
        description: "Plataforma educativa online con cursos, evaluaciones y gamificacion",
        icon: GraduationCap,
        agents: ["elearning_specialist", "instructional_designer", "fullstack_developer", "gamification_edu", "ux_designer", "video_producer"]
    },
    {
        title: "App de Telemedicina",
        description: "Aplicacion de salud digital con consultas y monitoreo",
        icon: Heart,
        agents: ["telemedicine_specialist", "mobile_developer", "health_data_analyst", "data_privacy_officer", "ux_designer", "security_specialist"]
    },
    {
        title: "Investigacion Cientifica",
        description: "Diseno experimental, analisis estadistico y publicacion",
        icon: Search,
        agents: ["research_scientist", "biostatistician", "data_scientist", "medical_writer", "statistician", "technical_writer_ed"]
    },
    {
        title: "Programa STEM para Jovenes",
        description: "Curriculum STEM con robotica, programacion y matematicas",
        icon: Cpu,
        agents: ["stem_educator", "math_educator", "gamification_edu", "curriculum_developer", "arduino_expert", "raspberry_pi_dev"]
    },
    {
        title: "App de Bienestar Mental",
        description: "Aplicacion de mindfulness, meditacion y seguimiento emocional",
        icon: Heart,
        agents: ["wellness_coach", "psychologist", "meditation_coach", "mobile_developer", "ux_designer", "content_writer"]
    },
    {
        title: "Laboratorio Digital",
        description: "Gestion de laboratorio con LIMS, datos y compliance",
        icon: Search,
        agents: ["lab_manager", "analytical_chemist", "data_governance", "quality_engineer", "biostatistician", "food_scientist"]
    },
    {
        title: "Educacion Inclusiva",
        description: "Programas educativos para necesidades especiales y bilingues",
        icon: BookOpen,
        agents: ["special_needs", "bilingual_education", "child_psychologist", "art_therapy_edu", "early_childhood", "montessori_expert"]
    },
    {
        title: "Nutricion y Fitness Digital",
        description: "Plataforma de nutricion personalizada y entrenamiento",
        icon: Heart,
        agents: ["nutritionist", "fitness_trainer", "health_data_analyst", "mobile_developer", "content_creator_personal", "data_scientist"]
    },
    {
        title: "Programa de Coaching Ejecutivo",
        description: "Coaching para C-level con liderazgo, productividad y bienestar",
        icon: Users,
        agents: ["executive_coach", "life_coach", "mindset_coach", "productivity_coach", "career_coach", "public_speaker_coach"]
    },
    {
        title: "Quimica y Farmacologia",
        description: "Investigacion quimica, formulacion farmaceutica y regulatorio",
        icon: Search,
        agents: ["pharmacologist", "organic_chemist", "environmental_chemist", "toxicologist", "regulatory_advisor", "materials_scientist"]
    },

    // 
    //  IA, DATA SCIENCE & AUTOMATIZACION (71-80)
    // 
    {
        title: "Sistema RAG Empresarial",
        description: "Retrieval-Augmented Generation para base de conocimiento interna",
        icon: Brain,
        agents: ["rag_architect", "llm_fine_tuner", "nlp_engineer", "data_engineer", "prompt_engineer", "backend_architect"]
    },
    {
        title: "Computer Vision Pipeline",
        description: "Sistema de vision por computadora: deteccion, clasificacion, deploy",
        icon: Camera,
        agents: ["computer_vision_specialist", "deep_learning_specialist", "mlops_engineer", "data_engineer", "devops_engineer", "python_scripter"]
    },
    {
        title: "Prompt Engineering Avanzado",
        description: "Optimizar prompts para ChatGPT, Claude y modelos open source",
        icon: Sparkles,
        agents: ["prompt_engineer", "chatgpt_expert", "claude_expert", "image_gen_expert", "llm_fine_tuner", "content_strategist"]
    },
    {
        title: "Data Science End-to-End",
        description: "Pipeline completo: EDA, feature engineering, modelo y deploy",
        icon: PieChart,
        agents: ["data_scientist", "ml_engineer", "data_engineer", "statistician", "data_viz_designer", "python_scripter"]
    },
    {
        title: "Automatizacion con No-Code",
        description: "Automatizar procesos con Zapier, n8n, Make sin codigo",
        icon: Workflow,
        agents: ["zapier_expert", "n8n_specialist", "nocode_expert", "process_automation", "task_scheduler", "workflow_architect"]
    },
    {
        title: "Sistema de Recomendaciones",
        description: "Motor de recomendaciones personalizado con ML",
        icon: Target,
        agents: ["recommendation_engineer", "ml_engineer", "data_scientist", "data_engineer", "backend_architect", "analytics_expert"]
    },
    {
        title: "NLP y Analisis de Texto",
        description: "Procesamiento de lenguaje natural: sentimiento, entidades, resumen",
        icon: FileText,
        agents: ["nlp_engineer", "deep_learning_specialist", "data_scientist", "python_scripter", "llm_fine_tuner", "translation_expert"]
    },
    {
        title: "Web Scraping & ETL",
        description: "Extraccion masiva de datos, limpieza y carga en data warehouse",
        icon: Database,
        agents: ["web_scraping", "etl_developer", "data_engineer", "python_scripter", "sql_analyst", "data_governance"]
    },
    {
        title: "Automatizacion DevOps CI/CD",
        description: "Pipeline completo: testing, build, deploy y monitoreo automatizado",
        icon: RefreshCw,
        agents: ["ci_cd_engineer", "docker_specialist", "kubernetes_expert", "terraform_expert", "ansible_specialist", "devops_engineer"]
    },
    {
        title: "Analytics y Excel Avanzado",
        description: "Dashboards, modelos financieros y automatizacion en Excel/SQL",
        icon: BarChart3,
        agents: ["excel_master", "sql_analyst", "powerbi_expert", "data_storyteller", "financial_math", "looker_specialist"]
    },

    // 
    //  SUSTENTABILIDAD & ENERGIA (81-85)
    // 
    {
        title: "Proyecto Solar Fotovoltaico",
        description: "Diseno, instalacion y ROI de planta solar",
        icon: Zap,
        agents: ["solar_engineer", "energy_auditor", "grid_engineer", "financial_analyst", "green_finance", "regulatory_advisor"]
    },
    {
        title: "Estrategia ESG Corporativa",
        description: "Reporte ESG, huella de carbono y economia circular",
        icon: Leaf,
        agents: ["esg_analyst", "carbon_footprint", "circular_economy", "sustainability_consultant_biz", "social_impact", "report_writer"]
    },
    {
        title: "Parque Eolico",
        description: "Diseno de parque eolico con analisis de viento y conexion a red",
        icon: RefreshCw,
        agents: ["wind_energy", "grid_engineer", "environmental_eng", "financial_analyst", "regulatory_advisor", "construction_manager"]
    },
    {
        title: "Supply Chain Sustentable",
        description: "Cadena de suministro verde con trazabilidad y reduccion de emisiones",
        icon: Truck,
        agents: ["sustainability_supply", "supply_chain_sust", "logistics_manager", "carbon_footprint", "procurement_specialist", "circular_economy"]
    },
    {
        title: "Energia y Almacenamiento",
        description: "Sistemas de almacenamiento de energia, baterias y hidrogeno",
        icon: Zap,
        agents: ["energy_storage", "hydrogen_expert", "renewable_energy", "grid_engineer", "energy_trading", "nuclear_specialist"]
    },

    // 
    //  AUTOMOTIVE & IoT (86-90)
    // 
    {
        title: "Vehiculo Electrico Startup",
        description: "Diseno EV, software automotriz y estaciones de carga",
        icon: Car,
        agents: ["ev_specialist", "automotive_software", "autonomous_driving", "ev_charging", "automotive_design", "connected_car"]
    },
    {
        title: "Fabrica Inteligente IoT",
        description: "Industria 4.0 con sensores, SCADA y mantenimiento predictivo",
        icon: Factory,
        agents: ["industrial_iot", "scada_engineer", "plc_programmer", "sensor_specialist", "maintenance_engineer", "supply_chain_mfg"]
    },
    {
        title: "Producto IoT de Hardware",
        description: "Diseno de producto IoT: firmware, PCB, cloud y app",
        icon: Cpu,
        agents: ["iot_architect", "firmware_engineer", "pcb_designer", "esp32_developer", "mobile_developer", "iot_security"]
    },
    {
        title: "Fleet Management",
        description: "Gestion de flota vehicular con telematica y optimizacion",
        icon: Truck,
        agents: ["fleet_manager", "connected_car", "logistics_coordinator", "data_scientist", "mobility_consultant", "iot_architect"]
    },
    {
        title: "Motorsport Engineering",
        description: "Ingenieria de competicion: aerodinamica, telemetria y rendimiento",
        icon: Flag,
        agents: ["motorsport_engineer", "automotive_design", "auto_manufacturing", "data_scientist", "materials_scientist", "simulation_dev"]
    },

    // 
    //  MARKETING & VENTAS AVANZADO (91-95)
    // 
    {
        title: "SEO Full Stack",
        description: "SEO tecnico, on-page, link building, local y analytics",
        icon: Search,
        agents: ["seo_specialist", "technical_seo", "link_builder", "local_seo", "seo_analytics_expert", "seo_automation"]
    },
    {
        title: "Growth Hacking B2B",
        description: "Estrategia de crecimiento agresivo para B2B: leads, PLG y virality",
        icon: Rocket,
        agents: ["growth_hacker", "saas_growth", "startup_growth_hacker", "linkedin_strategist", "content_strategist", "sales_engineer"]
    },
    {
        title: "Equipo de Ventas Elite",
        description: "Training, scripts, pipeline CRM y metricas de ventas",
        icon: Phone,
        agents: ["sales_trainer", "sales_executive", "sales_analyst", "crm_specialist", "sales_engineer", "business_development"]
    },
    {
        title: "Campana Marketing 360",
        description: "Campana multicanal: PPC, social, email, content y analytics",
        icon: Megaphone,
        agents: ["content_strategist", "ppc_specialist", "social_media_manager", "email_marketer", "analytics_expert", "copywriter"]
    },
    {
        title: "UX/UI Design System",
        description: "Sistema de diseno completo con componentes, tokens y guidelines",
        icon: Palette,
        agents: ["design_system", "ui_designer", "ux_designer", "interaction_designer", "ui_visual_designer", "ux_writer"]
    },

    // 
    //  BLOCKCHAIN & WEB3 (96-100)
    // 
    {
        title: "DApp Ethereum Full",
        description: "Aplicacion descentralizada: smart contracts, frontend y deploy",
        icon: Wallet,
        agents: ["solidity_dev", "web3_frontend", "blockchain_security", "rust_blockchain", "defi_architect", "cryptographer_math"]
    },
    {
        title: "Proyecto DeFi",
        description: "Protocolo DeFi: AMM, lending, yield farming y tokenomics",
        icon: DollarSign,
        agents: ["defi_architect", "solidity_dev", "tokenomics_expert", "crypto_analyst", "blockchain_security", "financial_math"]
    },
    {
        title: "DAO y Gobernanza",
        description: "Organizacion autonoma descentralizada con votacion y treasury",
        icon: Users,
        agents: ["dao_specialist", "solidity_dev", "tokenomics_expert", "corporate_lawyer", "social_media_manager", "web3_frontend"]
    },
    {
        title: "NFT Marketplace",
        description: "Plataforma de NFTs: minting, trading y comunidad",
        icon: Sparkles,
        agents: ["nft_developer", "web3_frontend", "solidity_dev", "ui_designer", "creative_director", "blockchain_security"]
    },
    {
        title: "Layer 2 Scaling",
        description: "Soluciones de escalabilidad L2: rollups, sidechains y bridges",
        icon: Layers,
        agents: ["layer2_developer", "rust_blockchain", "solidity_dev", "cryptographer_math", "blockchain_security", "devops_engineer"]
    }
];
