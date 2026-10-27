import { describe, it, expect } from 'vitest';
import { resolveVariables, VariableMapping } from './use-broadcast-sending';
import type { Contact } from '@/types';

const mockContact: Contact = {
	id: 'contact-1',
	user_id: 'user-1',
	account_id: 'acc-1',
	name: 'Carlos Mendoza',
	phone: '+5491112345678',
	email: 'carlos@ejemplo.com',
	company: 'Neobotia Labs',
	created_at: new Date().toISOString(),
	updated_at: new Date().toISOString(),
};

describe('resolveVariables', () => {
	it('resuelve variables posicionales manteniendo orden numerico', () => {
		const variables: Record<string, VariableMapping> = {
			'1': { type: 'field', value: 'name' },
			'2': { type: 'field', value: 'company' },
			'3': { type: 'static', value: '25 de Mayo' },
		};

		const result = resolveVariables(variables, mockContact);
		expect(result).toEqual(['Carlos Mendoza', 'Neobotia Labs', '25 de Mayo']);
	});

	it('resuelve variables con nombre respetando el orden del cuerpo de la plantilla', () => {
		const bodyText = 'Hola {{nombre_cliente}}, confirmamos que su empresa {{empresa}} tiene fecha para {{fecha_cita}}.';
		const variables: Record<string, VariableMapping> = {
			empresa: { type: 'field', value: 'company' },
			fecha_cita: { type: 'static', value: '15/11/2026' },
			nombre_cliente: { type: 'field', value: 'name' },
		};

		const result = resolveVariables(variables, mockContact, undefined, bodyText);
		expect(result).toEqual(['Carlos Mendoza', 'Neobotia Labs', '15/11/2026']);
	});

	it('resuelve campos personalizados desde el mapa de customValues', () => {
		const bodyText = 'Hola {{1}}, su plan es {{2}}';
		const customValues = new Map<string, string>([
			['cf-plan-id', 'Premium Pro'],
		]);
		const variables: Record<string, VariableMapping> = {
			'1': { type: 'field', value: 'name' },
			'2': { type: 'custom_field', value: 'cf-plan-id' },
		};

		const result = resolveVariables(variables, mockContact, customValues, bodyText);
		expect(result).toEqual(['Carlos Mendoza', 'Premium Pro']);
	});

	it('retorna cadena vacia si una variable no esta mapeada', () => {
		const bodyText = 'Hola {{1}}, su código es {{2}}';
		const variables: Record<string, VariableMapping> = {
			'1': { type: 'field', value: 'name' },
		};

		const result = resolveVariables(variables, mockContact, undefined, bodyText);
		expect(result).toEqual(['Carlos Mendoza', '']);
	});
});
