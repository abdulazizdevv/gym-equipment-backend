"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteProduct = exports.putProduct = exports.getOneProduct = exports.getCategoryProducts = exports.getAllProducts = exports.createProduct = void 0;
const uuid_1 = require("uuid");
const fs_1 = __importDefault(require("fs"));
const Product_1 = __importDefault(require("../../models/Product"));
const Category_1 = __importDefault(require("../../models/Category"));
const path_1 = __importDefault(require("path"));
const createProduct = async (req, res, next) => {
    try {
        const { title, description, price, categoryId } = req.body;
        const image = req.files?.image;
        if (!image) {
            return res.status(400).json({ message: "Image not found" });
        }
        const extname = Array.isArray(image)
            ? image[0].mimetype.split("/")[1]
            : image.mimetype.split("/")[1];
        const imageName = `${(0, uuid_1.v4)()}.${extname}`;
        if (Array.isArray(image)) {
            image[0].mv(`${process.cwd()}/uploads/${imageName}`);
        }
        else {
            image.mv(`${process.cwd()}/uploads/${imageName}`);
        }
        await Product_1.default.create({
            image: imageName,
            title,
            description,
            price,
            categoryId,
        });
        res.status(201).json({ message: "Successfully Created Product" });
    }
    catch (error) {
        next(error);
    }
};
exports.createProduct = createProduct;
const getAllProducts = async (req, res, next) => {
    try {
        const product = await Product_1.default.findAll();
        if (product) {
            res.status(200).json(product);
        }
        else {
            res.status(200).json({ message: "Not product" });
        }
    }
    catch (error) {
        next(error);
    }
};
exports.getAllProducts = getAllProducts;
const getCategoryProducts = async (req, res, next) => {
    try {
        const { id } = req.params;
        console.log(id);
        const product = await Product_1.default.findAll({
            include: {
                model: Category_1.default,
                where: { id },
            },
        });
        console.log(product);
        if (product) {
            res.status(200).json(product);
        }
        else {
            res.status(200).json({ message: "Not product" });
        }
    }
    catch (error) {
        console.log(error);
        next(error);
    }
};
exports.getCategoryProducts = getCategoryProducts;
const getOneProduct = async (req, res, next) => {
    try {
        const { id } = req.params;
        const data = await Product_1.default.findOne({ where: { id } });
        if (data !== null) {
            res.status(200).json(data);
        }
        else {
            res.status(403).json({ message: "Not found this product" });
        }
    }
    catch (error) {
        next(error);
    }
};
exports.getOneProduct = getOneProduct;
const putProduct = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { title, description, price } = req.body;
        const image = req.files?.image;
        const extname = Array.isArray(image)
            ? image[0].mimetype.split("/")[1]
            : image?.mimetype.split("/")[1];
        const imageName = `${(0, uuid_1.v4)()}.${extname}`;
        const existingProduct = await Product_1.default.findOne({ where: { id } });
        const imagePath = existingProduct?.dataValues.image;
        if (!existingProduct) {
            return res.status(404).json({ message: "Product not found" });
        }
        const filePath = path_1.default.join(process.cwd(), "uploads", imagePath);
        if (image) {
            if (fs_1.default.existsSync(filePath)) {
                fs_1.default.unlinkSync(filePath);
                console.log("Image file deleted successfully");
            }
            else {
                res.status(403).json({ message: "Image file does not exist" });
            }
        }
        let updatedImageName = existingProduct.image;
        if (Array.isArray(image)) {
            image[0].mv(`${process.cwd()}/uploads/${imageName}`);
            updatedImageName = imageName;
            // Delete the old image if it exists
            if (existingProduct.image) {
                fs_1.default.unlinkSync(`${process.cwd()}/uploads/${existingProduct.image}`);
            }
        }
        else {
            if (image) {
                image.mv(`${process.cwd()}/uploads/${imageName}`);
                updatedImageName = imageName;
                // Delete the old image if it exists
                if (existingProduct.image) {
                    fs_1.default.unlinkSync(`${process.cwd()}/uploads/${existingProduct.image}`);
                }
            }
        }
        // Uncomment the following lines when you are ready to update the product in the database
        await Product_1.default.update({
            image: updatedImageName,
            title,
            description,
            price,
        }, { where: { id } });
        res.status(201).json({ message: "Successfully Updated" });
    }
    catch (error) {
        next(error);
    }
};
exports.putProduct = putProduct;
const deleteProduct = async (req, res, next) => {
    try {
        const { id } = req.params;
        const product = await Product_1.default.findOne({ where: { id: id } });
        if (!product) {
            res.status(404).json({ message: "Product not found" });
            return;
        }
        const imagePath = product.dataValues.image;
        await Product_1.default.destroy({ where: { id } });
        // Delete the corresponding image file from the file system
        try {
            const filePath = path_1.default.join(process.cwd(), "uploads", imagePath);
            if (fs_1.default.existsSync(filePath)) {
                fs_1.default.unlinkSync(filePath);
                console.log("Image file deleted successfully");
            }
            else {
                res.status(403).json({ message: "Image file does not exist" });
            }
        }
        catch (error) {
            console.error("Error deleting image file:", error);
        }
        res.status(200).json({ message: "Successfully deleted" });
    }
    catch (error) {
        console.error("Error deleting product:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.deleteProduct = deleteProduct;
