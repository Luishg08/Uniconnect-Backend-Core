export interface NotificacionDTO {
  id_user: number;
  mensaje: string;
  tipo_evento: string;
  entidad_relacionada_id?: number;
  metadata?: Record<string, unknown>;
}

export interface ResultadoEnvio {
  canal: string;
  exitoso: boolean;
  error?: string;
  timestamp: Date;
}

export interface INotificacionStrategy {
  readonly canal: string;
  enviar(notificacion: NotificacionDTO): Promise<ResultadoEnvio>;
}
