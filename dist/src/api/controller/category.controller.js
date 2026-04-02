"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteCategory = exports.putCategory = exports.getOneCategory = exports.getAllCategory = exports.postCategory = void 0;
const Category_1 = __importDefault(require("../../models/Category"));
const postCategory = async (req, res, next) => {
    try {
        const { name } = req.body;
        await Category_1.default.create({
            name,
        });
        res.status(201).json({ message: "Successfully Created Category" });
    }
    catch (error) {
        next(error);
    }
};
exports.postCategory = postCategory;
const getAllCategory = async (req, res, next) => {
    try {
        const category = await Category_1.default.findAll();
        if (category) {
            res.status(200).json(category);
        }
        else {
            res.status(200).json({ message: "No category found" });
        }
    }
    catch (error) {
        next(error);
    }
};
exports.getAllCategory = getAllCategory;
const getOneCategory = async (req, res, next) => {
    try {
        const { id } = req.params;
        const data = await Category_1.default.findOne({ where: { id } });
        if (data !== null) {
            res.status(200).json(data);
        }
        else {
            res.status(403).json({ message: "Category not found" });
        }
    }
    catch (error) {
        next(error);
    }
};
exports.getOneCategory = getOneCategory;
const putCategory = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name } = req.body;
        await Category_1.default.update({
            name,
        }, { where: { id } });
        res.status(201).json({ message: "Successfully Updated" });
    }
    catch (error) {
        next(error);
    }
};
exports.putCategory = putCategory;
const deleteCategory = async (req, res, next) => {
    try {
        const { id } = req.params;
        await Category_1.default.destroy({ where: { id } });
        res.status(200).json({ message: "Successfully Deleted" });
    }
    catch (error) {
        next(error);
    }
};
exports.deleteCategory = deleteCategory;
